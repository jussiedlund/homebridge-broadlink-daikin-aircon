const Broadlink = require('kiwicam-broadlinkjs-rm');
const broadlink_helper = require("./broadlink-helper")
const daikin = require("./daikin")
class DaikinAirconAccessory {
  constructor(log, config, api) {
    this.log = log;
    this.config = config;
    this.api = api;

    this.device = null; // Store the Broadlink device reference
    this.deviceDiscoveryTimeout = 5000; // Timeout for device discovery in milliseconds
    this.broadlink = new Broadlink();

    this.temperature = 32;
    this.humidity = 100;

    this.daikin = new daikin.DaikinAircon()

    this.discoverDevice();

    // Accessory Information Service
    this.informationService = new this.api.hap.Service.AccessoryInformation()
      .setCharacteristic(this.api.hap.Characteristic.Manufacturer, "Daikin")
      .setCharacteristic(this.api.hap.Characteristic.Model, "Air Conditioner");

    this.airconService = new this.api.hap.Service.Thermostat(config.name, "aircon-main");

    this.airconService.getCharacteristic(this.api.hap.Characteristic.TargetHeatingCoolingState)
    .setProps({
      validValues: [
        this.api.hap.Characteristic.TargetHeatingCoolingState.OFF,
        this.api.hap.Characteristic.TargetHeatingCoolingState.AUTO,
        this.api.hap.Characteristic.TargetHeatingCoolingState.COOL
      ]
    })
    .onGet(this.getTargetAirconHeatingCoolingState.bind(this))
    .onSet(this.setTargetAirconHeatingCoolingState.bind(this));



    this.airconService.getCharacteristic(this.api.hap.Characteristic.TargetTemperature)
    .setProps({
      minValue: 16,
      maxValue: 30,
      minStep: 0.5
    })
    .onGet(this.getTargetTemperature.bind(this))
    .onSet(this.setTargetTemperature.bind(this));

    this.airconService.getCharacteristic(this.api.hap.Characteristic.CurrentTemperature)
    .onGet(this.getCurrentTemperature.bind(this))


    this.humidityService = new this.api.hap.Service.HumiditySensor(`${config.name} Humidity`, "humidity");

    this.humidityService.getCharacteristic(this.api.hap.Characteristic.CurrentRelativeHumidity)
    .onGet(this.getCurrentHumidity.bind(this))


    this.airconService.getCharacteristic(this.api.hap.Characteristic.CurrentHeatingCoolingState)
    .setProps({
      validValues: [
        this.api.hap.Characteristic.TargetHeatingCoolingState.OFF,
        this.api.hap.Characteristic.TargetHeatingCoolingState.AUTO,
        this.api.hap.Characteristic.TargetHeatingCoolingState.COOL
      ]
    })
    .onGet(this.getCurrentAirconHeatingCoolingState.bind(this))

    this.airconService.setPrimaryService(true);


    // Fan Service
    this.fanService = new this.api.hap.Service.Fan(`${config.name} Fan`, "fan");

    this.fanService.getCharacteristic(this.api.hap.Characteristic.On)
      .onGet(this.getFanOnHandler.bind(this))
      .onSet(this.setFanOnHandler.bind(this));

    this.fanService.getCharacteristic(this.api.hap.Characteristic.RotationSpeed)
    .setProps({
	    minValue: 0,
	    maxValue: 100,
	    minStep: 100/6
  	})
      .onGet(this.getFanSpeedHandler.bind(this))
      .onSet(this.setFanSpeedHandler.bind(this));

    this.airconService.addLinkedService(this.fanService);

    // Powerful Mode Switch
    this.powerfulSwitchService = new this.api.hap.Service.Switch(`${config.name} Powerful Mode`, "powerful-mode");

    this.send_broadlink = () =>{
      console.log("should send broadlink message")
      const message = this.daikin.createDaikinCodeForSending()
      const pulses = broadlink_helper.pulsesToData(message)
      this.device.sendData(Buffer.from(pulses))
    }

    this.powerfulSwitchService.getCharacteristic(this.api.hap.Characteristic.On)
      .onGet(() => this.isPowerfulMode)
      .onSet((value) => {
        this.daikin.powerfulMode = value;
        this.send_broadlink();
        // this.isPowerfulMode = value;
        this.log.info(`Powerful Mode -> ${value}`);
        // Add Broadlink command for Powerful Mode here
      });

    this.isPowerfulMode = false;

    // Econo Mode Switch
    this.econoSwitchService = new this.api.hap.Service.Switch(`${config.name} Econo Mode`, "econo-mode");

    this.econoSwitchService.getCharacteristic(this.api.hap.Characteristic.On)
      .onGet(() => this.isEconoMode)
      .onSet((value) => {
        this.econoMode = value;
        this.log.info(`Econo Mode -> ${value}`);
        this.send_broadlink();
        // Add Broadlink command for Econo Mode here
      });

    this.isEconoMode = false;
    this.log.info("DaikinAirconAccessory constructor finished");
  }

  // Air Conditioner Handlers
  getCurrentAirconHeatingCoolingState() {
    if(this.daikin.power == false) {
      return this.api.hap.Characteristic.CurrentHeatingCoolingState.OFF;
    }
    switch (this.daikin.mode) {
      case daikin.DaikinAircon.AC_MODES.COOL:
        return this.api.hap.Characteristic.CurrentHeatingCoolingState.COOL;
      case daikin.DaikinAircon.AC_MODES.AUTO:
        return this.api.hap.Characteristic.CurrentHeatingCoolingState.AUTO;
      case daikin.DaikinAircon.AC_MODES.FAN:
        return this.api.hap.Characteristic.CurrentHeatingCoolingState.HEAT;
      default:
        return this.api.hap.Characteristic.CurrentHeatingCoolingState.OFF;
      }
  }


  getTargetAirconHeatingCoolingState() {
    this.log.info("GET Air Conditioner Target Heating Cooling State");
    if(this.daikin.power == false) {
      return this.api.hap.Characteristic.CurrentHeatingCoolingState.OFF;
    }
    switch (this.daikin.mode) {
      case daikin.DaikinAircon.AC_MODES.COOL:
        return this.api.hap.Characteristic.CurrentHeatingCoolingState.COOL;
      case daikin.DaikinAircon.AC_MODES.AUTO:
        return this.api.hap.Characteristic.CurrentHeatingCoolingState.AUTO;
      case daikin.DaikinAircon.AC_MODES.FAN:
        return this.api.hap.Characteristic.CurrentHeatingCoolingState.HEAT;
      default:
        return this.api.hap.Characteristic.CurrentHeatingCoolingState.OFF;
      }
  }


setTargetAirconHeatingCoolingState(value) {
  this.log.info("SET Air Conditioner Target Heating Cooling State ->", value);
  switch (value) {
    case this.api.hap.Characteristic.TargetHeatingCoolingState.OFF:
      this.log.info("Turning Air Conditioner OFF");
      this.daikin.power = false;
      this.fanService.getCharacteristic(this.api.hap.Characteristic.On).setValue(0, undefined, 'fromSetValue');
      break;
    case this.api.hap.Characteristic.TargetHeatingCoolingState.COOL:
      this.log.info("Setting Air Conditioner to COOL");
      this.daikin.power = true;
      this.daikin.mode = daikin.DaikinAircon.AC_MODES.COOL;
      this.fanService.getCharacteristic(this.api.hap.Characteristic.On).setValue(1, undefined, 'fromSetValue');
      // Send Broadlink command to set to cool
      break;
    case this.api.hap.Characteristic.TargetHeatingCoolingState.AUTO:
      this.log.info("Setting Air Conditioner to AUTO");
      this.daikin.power = true;
      this.daikin.mode = daikin.DaikinAircon.AC_MODES.AUTO;
      this.fanService.getCharacteristic(this.api.hap.Characteristic.On).setValue(1, undefined, 'fromSetValue');
      // Send Broadlink command to set to auto
      break;
    default:
      this.log.warn("Unhandled state:", value);
  }
  this.send_broadlink();
}

getTargetTemperature() {
  this.device.checkTemperature();
  return this.daikin.temperature;
}

setTargetTemperature(value) {
  this.daikin.temperature = value;
  this.send_broadlink();
}

getCurrentTemperature() {
  this.device.checkTemperature();
  this.log.info("Get current temperature: ", this.temperature);
  return this.temperature;
}

getCurrentHumidity() {
  this.device.checkTemperature();
  this.log.info("Get current humidity: ", this.humidity);
  return this.humidity;
}


// Fan Handlers
  getFanOnHandler() {
    return this.daikin.power;
  }

  setFanOnHandler(value) {
    if(value === this.daikin.power) return;
    this.log.info("SET Fan On ->", value);
    this.daikin.power = value
    this.send_broadlink();
    // Add Broadlink command to turn fan on/off here
  }

  getFanSpeedHandler() {
    if(!this.daikin.power) return 0;
    switch(this.daikin.fanSpeed) {
      case daikin.DaikinAircon.FAN_SPEEDS.QUIET:
        this.log.info("Fan Speed is QUIET");
        return 16.666666666666668;
      case daikin.DaikinAircon.FAN_SPEEDS.LEVEL1:
        this.log.info("Fan Speed is Level1");
        return 33.333333333333336;
      case daikin.DaikinAircon.FAN_SPEEDS.LEVEL2:
        this.log.info("Fan Speed is Level2");
        return 50;
      case daikin.DaikinAircon.FAN_SPEEDS.LEVEL3:
        this.log.info("Fan Speed is Level3");
        return 66.66666666666667;
      case daikin.DaikinAircon.FAN_SPEEDS.LEVEL4:
        this.log.info("Fan Speed is Level4");
        return 83.33333333333334;
      case daikin.DaikinAircon.FAN_SPEEDS.LEVEL5:
        this.log.info("Fan Speed is Level5");
        return 100;
    }
    return this.fanSpeed;
  }

  setFanSpeedHandler(value) {
    this.log.info("SET Fan Speed ->", value);
    if(value == 0) daikin.power = false;
    switch(value) {
      case value <= 16.67:
        this.daikin.fanSpeed = daikin.DaikinAircon.FAN_SPEEDS.QUIET
        break;
      case value <= 33.34:
        this.daikin.fanSpeed = daikin.DaikinAircon.FAN_SPEEDS.LEVEL1
        break;
      case value <= 50:
        this.daikin.fanSpeed = daikin.DaikinAircon.FAN_SPEEDS.LEVEL2
        break;
      case value <= 66.67:
        this.daikin.fanSpeed = daikin.DaikinAircon.FAN_SPEEDS.LEVEL3
        break;
      case value <= 83.34:
        this.daikin.fanSpeed = daikin.DaikinAircon.FAN_SPEEDS.LEVEL4
        break;
      default:
        this.daikin.fanSpeed = daikin.DaikinAircon.FAN_SPEEDS.LEVEL5
        break

      }
    this.send_broadlink();
  }

  getServices() {
    return [
      this.informationService,
      this.airconService,
      this.fanService,
      this.powerfulSwitchService, 
      this.humidityService
//      this.econoSwitchService
    ];
  }

  discoverDevice() {
      this.log.info("Discovering Broadlink device...");

      // Start discovery
      this.broadlink.discover();

      this.broadlink.on("deviceReady", (device) => {
        const mac = device.mac.toString("hex").toUpperCase();
        const host = device.host.address;

        this.log.info(`Discovered device: MAC=${mac}, Host=${host}`);

        // Match device by MAC or Host from config
        if ((this.config.mac && mac === this.config.mac.toUpperCase()) || (this.config.host && host === this.config.host)) {
          this.device = device;
          this.device.checkTemperature();
          this.log.info(`Broadlink device matched: MAC=${mac}, Host=${host}`);

          device.authenticate();

          device.on("temperature", (temperature,humidity) => {
            this.log.info(`Temperature: ${temperature} Humidity: ${humidity}`);
            this.temperature = temperature;
            this.humidity = humidity;
            this.airconService.getCharacteristic(this.api.hap.Characteristic.CurrentTemperature).updateValue(temperature);
          });


        }
    });
    

    // Stop discovery after timeout
    setTimeout(() => {
      if (!this.device) {
        this.log.warn("No Broadlink device found matching the configuration.");
      }
    }, this.deviceDiscoveryTimeout);

  }
}


module.exports = (api) => {
  api.registerAccessory('DaikinAircon', DaikinAirconAccessory);
};