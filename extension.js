const { St, Clutter, GLib, GObject, Gio } = imports.gi;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const UPower = imports.gi.UPowerGlib;

var BatteryIndicator = GObject.registerClass(
class BatteryIndicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, 'Battery Indicator', false);
   
        // Crear un contenedor horizontal para el ícono y el texto
        this.box = new St.BoxLayout({ vertical: false });
        
        // Crear el ícono de auriculares
        this.icon = new St.Icon({
            gicon: Gio.icon_new_for_string('audio-headphones-symbolic'), // Usa un ícono simbólico
            style_class: 'system-status-icon',
        });
   
        // Crear la etiqueta para mostrar el nivel de batería
        this.label = new St.Label({
            text: '--%',
            y_align: Clutter.ActorAlign.CENTER
        });
   
        // Añadir el ícono y la etiqueta al contenedor
        this.box.add_child(this.icon);
        this.box.add_child(this.label);
   
        // Añadir el contenedor al botón
        this.add_child(this.box);
   
        this._timeout = null;
        this._devicePath = null;
   
        // Crear el cliente de UPower
        this._client = new UPower.Client();
        
        // Conectar a la señal de UPower para detectar cambios en los dispositivos
        this._client.connect('device-added', this._onDeviceChanged.bind(this));
        this._client.connect('device-removed', this._onDeviceChanged.bind(this));
        
        // Forzar una actualización inicial
        this._update();
    }
   
    _onDeviceChanged() {
        // Forzar la actualización cuando se detecta un cambio en los dispositivos
        this._devicePath = null;  // Resetea el dispositivo encontrado
        this._update();
    }   

    _findDevicePath() {
        let [res, out, err, status] = GLib.spawn_command_line_sync('upower -e');
        if (status === 0) {
            let devices = out.toString().split('\n');
            for (let device of devices) {
                if (device.includes('headset')) {
                    return device.trim();
                }
            }
        }
        return null;
    }

    _getBatteryLevel() {
        if (this._devicePath) {
            let [res, out, err, status] = GLib.spawn_command_line_sync(`upower -i ${this._devicePath}`);
            if (status === 0) {
                let output = out.toString();
                let match = output.match(/percentage:\s+(\d+)%/);
                if (match) {
                    return match[1] + '%';
                }
            }
        }
        return '--%';
    }

    _update() {
        if (this._timeout) {
            GLib.source_remove(this._timeout);
        }

        this._devicePath = this._findDevicePath();

        if (this.label) {
            this.label.set_text(this._getBatteryLevel());
        }

        this._timeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 60, () => {
            this._update();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _onDeviceChanged() {
        this._update();
    }

    destroy() {
        if (this._timeout) {
            GLib.source_remove(this._timeout);
            this._timeout = null;
        }
        if (this.label) {
            this.label.destroy();
            this.label = null;
        }
        if (this.icon) {
            this.icon.destroy();
            this.icon = null;
        }
        super.destroy();
    }
});

let batteryIndicator;

function init() {}

function enable() {
    batteryIndicator = new BatteryIndicator();
    Main.panel.addToStatusArea('battery-indicator', batteryIndicator, 1, 'right');
}

function disable() {
    if (batteryIndicator) {
        batteryIndicator.destroy();
        batteryIndicator = null;
    }
}
