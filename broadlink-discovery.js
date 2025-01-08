const Broadlink = require('kiwicam-broadlinkjs-rm');

class BroadlinkDiscovery {
  constructor(log) {
    this.log = log;
    this.broadlink = new Broadlink();
    this.devices = {}; // Map of discovered devices
    this.discoveryInProgress = false;
    this.pingInterval = 30000; // Interval in milliseconds for pinging devices
  }

  discover(config, timeout = 10000) {
    const key = config.mac?.toUpperCase() || config.host;

    if (this.devices[key]) {
      this.log.info(`Device already discovered for key ${key}`);
      return Promise.resolve(this.devices[key]);
    }

    if (this.discoveryInProgress) {
      this.log.info("Discovery in progress. Waiting for completion...");
      return new Promise((resolve) => {
        const interval = setInterval(() => {
          if (this.devices[key]) {
            clearInterval(interval);
            resolve(this.devices[key]);
          }
        }, 100);
      });
    }

    this.log.info("Starting Broadlink device discovery...");
    this.discoveryInProgress = true;

    return new Promise((resolve, reject) => {
      this.broadlink.discover();

      this.broadlink.on("deviceReady", (device) => {
        const mac = device.mac.toString("hex").toUpperCase();
        const host = device.host.address;
        const deviceKey = mac || host;

        this.log.info(`Discovered device: MAC=${mac}, Host=${host}`);

        if (!this.devices[deviceKey]) {
          this.devices[deviceKey] = device;
          this.log.info(`Device added to map: Key=${deviceKey}`);
        }

        if (
          (config.mac && mac === config.mac.toUpperCase()) ||
          (config.host && host === config.host)
        ) {
          this.log.info(`Matching device found for key ${key}`);
          this.discoveryInProgress = false;
          resolve(this.devices[deviceKey]);
        }
      });

      setTimeout(() => {
        if (!this.devices[key]) {
          this.log.warn(`No Broadlink device found matching the configuration for key ${key}`);
          this.discoveryInProgress = false;
          reject(new Error("Device discovery timeout"));
        }
      }, timeout);
    });
  }


  startPing(device) {
    this.log.info(`Starting periodic ping for device: MAC=${device.mac.toString("hex").toUpperCase()}`);
    setInterval(() => {
      try {
        device.checkTemperature?.(); // Example: check temperature to ensure connectivity
        this.log.info(`Ping successful for device: MAC=${device.mac.toString("hex").toUpperCase()}`);
      } catch (err) {
        this.log.warn(`Ping failed for device: MAC=${device.mac.toString("hex").toUpperCase()}, attempting rediscovery.`);
        this.rediscoverDevice(device);
      }
    }, this.pingInterval);
  }

  rediscoverDevice(device) {
    const mac = device.mac.toString("hex").toUpperCase();
    this.log.info(`Attempting rediscovery for device: MAC=${mac}`);
    device.authenticate((err) => {
      if (err) {
        this.log.error(`Failed to reauthenticate device: MAC=${mac}`, err);
      } else {
        this.log.info(`Reauthenticated device: MAC=${mac}`);
      }
    });
  }


}

module.exports = BroadlinkDiscovery;
