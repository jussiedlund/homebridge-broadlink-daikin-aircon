const Broadlink = require('kiwicam-broadlinkjs-rm');
const broadlink = new Broadlink();



const pulsesToData = (pulses, tick = 32.84) => {
  const result = [0x26, 0x00, 0x00, 0x00]; // Initialize header

  pulses.forEach((pulse) => {
      const scaled = Math.floor(pulse / tick);
      const div = Math.floor(scaled / 256);
      const mod = scaled % 256;

      if (div > 0) {
          result.push(0x00); // Extended timing indicator
          result.push(div);  // High byte
      }
      result.push(mod); // Low byte
  });

  // Calculate and set the length of the timing data
  const dataLength = result.length - 4;
  result[2] = dataLength & 0xFF; // Low byte
  result[3] = (dataLength >> 8) & 0xFF; // High byte

  return result;
}





  module.exports = { pulsesToData };
