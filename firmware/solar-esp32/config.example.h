// Copie para config.h e preencha. NÃO versionar o config.h (tem o token do aparelho).
#pragma once

#define WIFI_SSID      "rede-da-igreja"
#define WIFI_PASSWORD  "senha-do-wifi"

// URL da função de ingestão: https://<projeto>.supabase.co/functions/v1/solar-ingest
#define INGEST_URL     "https://SEU-PROJETO.supabase.co/functions/v1/solar-ingest"
// Token gerado no painel (Energia solar → Cadastrar aparelho). Mostrado uma única vez.
#define DEVICE_TOKEN   "cole-aqui-o-token-de-64-caracteres"

// Perfil do inversor: PROFILE_HUAWEI, PROFILE_GROWATT, PROFILE_SOLIS, PROFILE_SUNGROW
#define INVERTER_PROFILE PROFILE_HUAWEI
#define MODBUS_UNIT_ID   1
#define MODBUS_BAUD      9600
#define MODBUS_PARITY    SERIAL_8N1   // paridade errada não dá erro, dá silêncio: teste 8E1 se não responder

// RS485 (MAX485/MAX3485): RO→RX, DI→TX, DE+RE juntos no pino de direção
#define RS485_RX_PIN   16
#define RS485_TX_PIN   17
#define RS485_DIR_PIN  4

#define SEND_INTERVAL_MS 60000UL
