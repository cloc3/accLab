# Impostiamo Bash come shell predefinita per Make (necessario per exec 5<>)
SHELL := /bin/bash

ARDMK_DIR := /usr/local/share/sudar

# 1. Scheda di default se non rilevata e se non esiste .current_board
DEFAULT_BOARD ?= uno

# 2. File di stato
BOARD_STATE_FILE := .current_board

# 3. Silenzia i warning di grep recenti
export GREP_OPTIONS := --no-warnings

# 4. LOGICA DI RILEVAMENTO AUTOMATICO / OVERRIDE
DETECTED_BOARD :=
ifneq ($(wildcard /dev/uno),)
    DETECTED_BOARD := uno
else ifneq ($(wildcard /dev/leonardo),)
    DETECTED_BOARD := leonardo
endif

ifneq ($(DETECTED_BOARD),)
    BOARD_TAG := $(DETECTED_BOARD)
    $(shell echo "$(DETECTED_BOARD)" > $(BOARD_STATE_FILE))
else ifneq ($(wildcard $(BOARD_STATE_FILE)),)
    BOARD_TAG := $(strip $(shell cat $(BOARD_STATE_FILE)))
else
    BOARD_TAG := $(DEFAULT_BOARD)
    $(shell echo "$(DEFAULT_BOARD)" > $(BOARD_STATE_FILE))
endif

# Configurazione ambiente e percorsi
AVR_TOOLS_DIR      := /usr
AVRDUDE            := /usr/bin/avrdude
AVRDUDE_CONF       := /etc/avrdude.conf
BOARDS_TXT         := /usr/share/arduino/hardware/arduino/avr/boards.txt

FORCE_MONITOR_PORT := /dev/$(BOARD_TAG)

CXXFLAGS += -fno-threadsafe-statics

# Target di default per la compilazione
.DEFAULT_GOAL := all

# Include del Makefile di Sudar (carica le variabili di compilazione e rileva il baudrate dallo sketch se c'è)
include $(ARDMK_DIR)/Arduino.mk

# -----------------------------------------------------------------------------
# RILEVAMENTO CAMBIO SYMLINK SKETCH
# -----------------------------------------------------------------------------

SKETCH_LINK_FILE := .current_sketch_link

# Ricaviamo il percorso reale puntato da sketch.ino (se è un symlink)
REAL_SKETCH_PATH := $(shell readlink -f sketch.ino 2>/dev/null)

ifneq ($(REAL_SKETCH_PATH),)
    LAST_SKETCH_PATH := $(strip $(shell cat $(SKETCH_LINK_FILE) 2>/dev/null))
    ifneq ($(REAL_SKETCH_PATH),$(LAST_SKETCH_PATH))
        $(shell rm -rf $(OBJDIR)/*.hex $(OBJDIR)/*.elf $(OBJDIR)/*.o)
        $(shell echo "$(REAL_SKETCH_PATH)" > $(SKETCH_LINK_FILE))
    endif
endif

# -----------------------------------------------------------------------------
# GESTIONE DINA MICA BAUDRATE PER IL MONITOR
# -----------------------------------------------------------------------------
# Se Arduino.mk non ha estratto un MONITOR_BAUDRATE dallo sketch (.ino),
# assegniamo il valore di fallback in base al BOARD_TAG attivo.
ifeq ($(MONITOR_BAUDRATE),)
    ifeq ($(BOARD_TAG),leonardo)
        BAUD_RATE := 57600
    else
        BAUD_RATE := 115200
    endif
else
    BAUD_RATE := $(MONITOR_BAUDRATE)
endif

# -----------------------------------------------------------------------------
# DEFINIZIONE DEL FILE HEX E SOVRASCRITTURA TARGET UPLOAD
# -----------------------------------------------------------------------------

HEX_TARGET := $(OBJDIR)/$(TARGET).hex

# Cancella la regola 'upload' fornita da Arduino.mk
upload:

# Ridefinisce 'upload' personalizzato
.PHONY: upload
upload: $(HEX_TARGET)
	@echo "=== Avvio Upload Personalizzato per: $(BOARD_TAG) su $(FORCE_MONITOR_PORT) ==="
	@echo "File da caricare: $(HEX_TARGET)"
	@if [ "$(BOARD_TAG)" = "leonardo" ]; then \
		echo "[1/3] Reset Leonardo/Pro Micro (1200 baud touch)..."; \
		stty -F $(FORCE_MONITOR_PORT) 1200 cs8 -cstopb -parity hupcl 2>/dev/null || true; \
		echo "[2/3] Attesa avvio bootloader (2s)..."; \
		sleep 2; \
		echo "[3/3] Caricamento firmware su /dev/leonardo_boot..."; \
		$(AVRDUDE) -C $(AVRDUDE_CONF) -v -p atmega32u4 -c avr109 -P /dev/leonardo_boot -b 57600 -D -U flash:w:$(HEX_TARGET):i; \
	else \
		echo "[1/3] Reset Uno (DTR reset via stty)..."; \
		stty -F $(FORCE_MONITOR_PORT) hupcl 2>/dev/null || true; \
		echo "[2/3] Breve pausa di assestamento (0.5s)..."; \
		sleep 0.5; \
		echo "[3/3] Caricamento firmware con avrdude (arduino)..."; \
		$(AVRDUDE) -C $(AVRDUDE_CONF) -v -p atmega328p -c arduino -P $(FORCE_MONITOR_PORT) -b 115200 -D -U flash:w:$(HEX_TARGET):i; \
	fi
	@echo "=== Upload completato con successo ==="

# -----------------------------------------------------------------------------
# TARGET PER LA LETTURA DELLA SERIALE (print)
# -----------------------------------------------------------------------------

.PHONY: print
print:
	@echo "=== Lettura Seriale su $(FORCE_MONITOR_PORT) (@ $(BAUD_RATE) baud) ==="
	@echo "Premere Ctrl+C per uscire."
	@bash -c '\
		stty -F $(FORCE_MONITOR_PORT) $(BAUD_RATE) raw -echo cs8 -cstopb -parity hupcl; \
		exec 5<>$(FORCE_MONITOR_PORT); \
		cat <&5; \
		exec 5>&-; \
	'

# -----------------------------------------------------------------------------
# TARGET ESPLICITI E MANUALI
# -----------------------------------------------------------------------------

.PHONY: nextBoard leonardo uno

nextBoard:
	@if [ "$(BOARD_TAG)" = "uno" ]; then \
		echo "leonardo" > $(BOARD_STATE_FILE); \
		echo "Scheda impostata manualmente su: leonardo"; \
	else \
		echo "uno" > $(BOARD_STATE_FILE); \
		echo "Scheda impostata manualmente su: uno"; \
	fi

leonardo:
	@echo "leonardo" > $(BOARD_STATE_FILE)
	@echo "Forzata scheda: leonardo"
	@$(MAKE) BOARD_TAG=leonardo

uno:
	@echo "uno" > $(BOARD_STATE_FILE)
	@echo "Forzata scheda: uno"
	@$(MAKE) BOARD_TAG=uno
