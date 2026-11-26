/*
  Medidor solar da plataforma — ESP32 + RS485 (Modbus RTU direto no inversor).
  Lê potência, energia, tensões, temperatura, estado e falha a cada minuto e envia
  para a Edge Function `solar-ingest` (HTTPS + token do aparelho).

  Placa: ESP32 Dev Module (Arduino core para ESP32). Sem bibliotecas externas.
  Ligação: ESP32 ⇄ MAX485 ⇄ A/B do RS485 do inversor (GND comum recomendado).

  IMPORTANTE — mapas de registradores:
  - PROFILE_HUAWEI: campos dentro dos blocos já lidos em campo na frota
    (32064×27, 32106×10). Ainda assim confira a potência contra o display do inversor.
  - Demais perfis: ponto de partida a partir do manual do fabricante. VALIDAR EM CAMPO
    (comparar potência e energia com o display/app do fabricante) antes de vender.
*/
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <esp_task_wdt.h>
#include "config.h"

// ------------------------------------------------------------------ mapas
enum Fc : uint8_t { HOLDING = 3, INPUT_REG = 4 };
enum Kind : uint8_t { U16, I16, U32, I32 };
enum Order : uint8_t { HI_FIRST, LO_FIRST };   // ordem das words em 32 bits

struct Field {
  const char* key;   // nome no JSON enviado
  Fc fc;
  uint16_t addr;     // PDU (base 0, o que vai no telegrama)
  Kind kind;
  Order order;
  float scale;       // valor físico = bruto × scale
};

#define PROFILE_HUAWEI  1
#define PROFILE_GROWATT 2
#define PROFILE_SOLIS   3
#define PROFILE_SUNGROW 4

#if INVERTER_PROFILE == PROFILE_HUAWEI
// Huawei SUN2000 (FC03, words hi-first). Potência ativa em W; energias em 0,01 kWh.
const Field FIELDS[] = {
  {"power_w",          HOLDING, 32080, I32, HI_FIRST, 1.0f},
  {"energy_today_kwh", HOLDING, 32114, U32, HI_FIRST, 0.01f},
  {"energy_total_kwh", HOLDING, 32106, U32, HI_FIRST, 0.01f},
  {"dc_voltage_v",     HOLDING, 32016, I16, HI_FIRST, 0.1f},   // PV1
  {"ac_voltage_v",     HOLDING, 32069, U16, HI_FIRST, 0.1f},   // fase A
  {"temperature_c",    HOLDING, 32087, I16, HI_FIRST, 0.1f},
  {"status_code",      HOLDING, 32089, U16, HI_FIRST, 1.0f},   // 40960 = standby à noite
  {"fault_code",       HOLDING, 32090, U16, HI_FIRST, 1.0f},   // 0 = sem falha
};
#elif INVERTER_PROFILE == PROFILE_GROWATT
// Growatt (protocolo RTU v1.20+, FC04). A VALIDAR EM CAMPO.
const Field FIELDS[] = {
  {"power_w",          INPUT_REG, 35,  U32, HI_FIRST, 0.1f},
  {"energy_today_kwh", INPUT_REG, 53,  U32, HI_FIRST, 0.1f},
  {"energy_total_kwh", INPUT_REG, 55,  U32, HI_FIRST, 0.1f},
  {"dc_voltage_v",     INPUT_REG, 3,   U16, HI_FIRST, 0.1f},
  {"ac_voltage_v",     INPUT_REG, 38,  U16, HI_FIRST, 0.1f},
  {"temperature_c",    INPUT_REG, 93,  I16, HI_FIRST, 0.1f},
  {"status_code",      INPUT_REG, 0,   U16, HI_FIRST, 1.0f},   // 3 = falha
  {"fault_code",       INPUT_REG, 105, U16, HI_FIRST, 1.0f},
};
#elif INVERTER_PROFILE == PROFILE_SOLIS
// Solis (FC04, bloco 3004 lido na frota). Campos A VALIDAR EM CAMPO.
const Field FIELDS[] = {
  {"power_w",          INPUT_REG, 3004, U32, HI_FIRST, 1.0f},
  {"energy_today_kwh", INPUT_REG, 3014, U16, HI_FIRST, 0.1f},
  {"energy_total_kwh", INPUT_REG, 3008, U32, HI_FIRST, 1.0f},
  {"dc_voltage_v",     INPUT_REG, 3021, U16, HI_FIRST, 0.1f},
  {"ac_voltage_v",     INPUT_REG, 3033, U16, HI_FIRST, 0.1f},
  {"temperature_c",    INPUT_REG, 3041, I16, HI_FIRST, 0.1f},
  {"status_code",      INPUT_REG, 3043, U16, HI_FIRST, 1.0f},
  {"fault_code",       INPUT_REG, 3066, U16, HI_FIRST, 1.0f},
};
#elif INVERTER_PROFILE == PROFILE_SUNGROW
// Sungrow SG (FC04, U32 com word baixa primeiro). A VALIDAR EM CAMPO.
const Field FIELDS[] = {
  {"power_w",          INPUT_REG, 5030, U32, LO_FIRST, 1.0f},
  {"energy_today_kwh", INPUT_REG, 5002, U16, HI_FIRST, 0.1f},
  {"energy_total_kwh", INPUT_REG, 5003, U32, LO_FIRST, 1.0f},
  {"dc_voltage_v",     INPUT_REG, 5010, U16, HI_FIRST, 0.1f},
  {"ac_voltage_v",     INPUT_REG, 5018, U16, HI_FIRST, 0.1f},
  {"temperature_c",    INPUT_REG, 5007, I16, HI_FIRST, 0.1f},
  {"status_code",      INPUT_REG, 5037, U16, HI_FIRST, 1.0f},
  {"fault_code",       INPUT_REG, 5044, U16, HI_FIRST, 1.0f},
};
#else
#error "INVERTER_PROFILE inválido em config.h"
#endif

const size_t NFIELDS = sizeof(FIELDS) / sizeof(FIELDS[0]);

// ------------------------------------------------------------- Modbus RTU
HardwareSerial RS485(2);

static uint16_t crc16(const uint8_t* buf, size_t len) {
  uint16_t crc = 0xFFFF;
  for (size_t i = 0; i < len; i++) {
    crc ^= buf[i];
    for (int b = 0; b < 8; b++) crc = (crc & 1) ? (crc >> 1) ^ 0xA001 : crc >> 1;
  }
  return crc;
}

// Lê `count` registradores; devolve true e preenche `out` se a resposta for válida.
static bool modbusRead(uint8_t fc, uint16_t addr, uint16_t count, uint16_t* out) {
  uint8_t req[8] = {MODBUS_UNIT_ID, fc, (uint8_t)(addr >> 8), (uint8_t)addr, (uint8_t)(count >> 8), (uint8_t)count};
  uint16_t c = crc16(req, 6);
  req[6] = c & 0xFF;
  req[7] = c >> 8;

  while (RS485.available()) RS485.read();          // descarta lixo
  digitalWrite(RS485_DIR_PIN, HIGH);
  RS485.write(req, 8);
  RS485.flush();
  digitalWrite(RS485_DIR_PIN, LOW);

  const size_t expected = 5 + count * 2;
  uint8_t resp[5 + 2 * 4];
  size_t n = 0;
  uint32_t t0 = millis();
  while (n < expected && millis() - t0 < 1000) {
    if (RS485.available()) {
      resp[n++] = RS485.read();
      if (n == 5 && (resp[1] & 0x80)) break;        // exceção Modbus
    }
  }
  if (n < expected || resp[0] != MODBUS_UNIT_ID || resp[1] != fc || resp[2] != count * 2) return false;
  uint16_t rc = resp[expected - 2] | (resp[expected - 1] << 8);
  if (rc != crc16(resp, expected - 2)) return false;
  for (uint16_t i = 0; i < count; i++) out[i] = (resp[3 + 2 * i] << 8) | resp[4 + 2 * i];
  return true;
}

static bool readField(const Field& f, float& value) {
  uint16_t w[2];
  uint16_t count = (f.kind == U32 || f.kind == I32) ? 2 : 1;
  bool ok = false;
  for (int attempt = 0; attempt < 3 && !ok; attempt++) {
    ok = modbusRead(f.fc, f.addr, count, w);
    if (!ok) delay(100);
  }
  if (!ok) return false;
  switch (f.kind) {
    case U16: value = w[0] * f.scale; break;
    case I16: value = (int16_t)w[0] * f.scale; break;
    case U32: case I32: {
      uint32_t raw = f.order == HI_FIRST ? ((uint32_t)w[0] << 16) | w[1] : ((uint32_t)w[1] << 16) | w[0];
      value = (f.kind == I32 ? (float)(int32_t)raw : (float)raw) * f.scale;
      break;
    }
  }
  delay(30);  // intervalo entre telegramas (alguns inversores precisam)
  return true;
}

// ---------------------------------------------------------------- envio
static uint32_t lastOk = 0;

static void ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  for (int i = 0; i < 40 && WiFi.status() != WL_CONNECTED; i++) delay(500);
}

static bool sendReading(const String& json) {
  WiFiClientSecure tls;
  // TODO produção: fixar a CA raiz do domínio do Supabase com tls.setCACert(...).
  tls.setInsecure();
  HTTPClient http;
  if (!http.begin(tls, INGEST_URL)) return false;
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-token", DEVICE_TOKEN);
  http.setTimeout(15000);
  int code = http.POST(json);
  Serial.printf("[http] %d %s\n", code, http.getString().c_str());
  http.end();
  return code == 200;
}

void setup() {
  Serial.begin(115200);
  pinMode(RS485_DIR_PIN, OUTPUT);
  digitalWrite(RS485_DIR_PIN, LOW);
  RS485.begin(MODBUS_BAUD, MODBUS_PARITY, RS485_RX_PIN, RS485_TX_PIN);

  // Watchdog: se travar por 2 min, reinicia.
  esp_task_wdt_config_t wdt = {.timeout_ms = 120000, .idle_core_mask = 0, .trigger_panic = true};
  esp_task_wdt_reconfigure(&wdt);
  esp_task_wdt_add(NULL);

  ensureWifi();
  lastOk = millis();
}

void loop() {
  static uint32_t lastSend = 0;
  esp_task_wdt_reset();

  if (lastSend == 0 || millis() - lastSend >= SEND_INTERVAL_MS) {
    lastSend = millis();

    String json = "{";
    int okCount = 0;
    for (size_t i = 0; i < NFIELDS; i++) {
      float v;
      if (!readField(FIELDS[i], v)) {
        Serial.printf("[modbus] falha lendo %s (%u)\n", FIELDS[i].key, FIELDS[i].addr);
        continue;
      }
      if (okCount++) json += ",";
      json += "\""; json += FIELDS[i].key; json += "\":"; json += String(v, 3);
    }
    // Inversor mudo (desligado à noite ou cabo solto): envia só o heartbeat com rssi.
    if (okCount) json += ",";
    json += "\"rssi\":" + String(WiFi.RSSI()) + ",\"modbus_ok\":" + String(okCount) + "}";
    Serial.println(json);

    ensureWifi();
    if (WiFi.status() == WL_CONNECTED && sendReading(json)) lastOk = millis();
  }

  // Sem envio bem-sucedido por 30 min: reinicia (recupera Wi-Fi/TLS travados).
  if (millis() - lastOk > 30UL * 60UL * 1000UL) ESP.restart();
  delay(200);
}
