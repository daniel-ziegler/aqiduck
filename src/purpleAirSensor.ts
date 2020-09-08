import { Sensor, sensorData } from './interfaces/sensor';
import calculateAQI from './calculateAQI';
import axios from 'axios';

export default class PurpleAirSensor implements Sensor {
  sensorId: number;

  constructor({ id }: { id: number }) {
    this.sensorId = id;
  }

  async getData(): Promise<sensorData> {
    let response
    try {
      response = await axios.get(`https://www.purpleair.com/json?show=${this.sensorId}`);
      const results = response.data.results[0];
      if(!results) {
        // TODO: post a message to slack about this error state
        console.log(`Empty results for PurpleAir Sensor ${this.sensorId}`);
        return { error: "No results" }
      }
      const stats = JSON.parse(results.Stats);
      const currentPM2_5 = stats.v;
      const tenMinuteAveragePM2_5 = stats.v1;

      return {
        AQI: calculateAQI(tenMinuteAveragePM2_5),
        temperature: results.temp_f - 8
      };
    } catch(error) {
        console.log("Error getting data for PurpleAir sensor", this);
        console.log("Response:", response && response.data);
        console.log("Error:", error);
        return { error };
    }
  }
}
