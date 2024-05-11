/* eslint-disable max-classes-per-file */
/* eslint-disable no-restricted-globals */
/* eslint-disable no-undef */
$(document).ready(() => {
  // if deployed to a site supporting SSL, use wss://
  const protocol = document.location.protocol.startsWith('https') ? 'wss://' : 'ws://';
  const webSocket = new WebSocket(protocol + location.host);

  // A class for holding the last N points of telemetry for a device
  class DeviceData {
    constructor(deviceId) {
      this.deviceId = deviceId;
      this.maxLen = 50;
      this.timeData = new Array(this.maxLen);
      this.temperatureData = new Array(this.maxLen);
      this.humidityData = new Array(this.maxLen);
      //------ NEW --------
      this.phData = new Array(this.maxLen); 
      this.precipitateData = new Array(this.maxLen); 
    }

    addData(time, temperature, humidity) {
      this.timeData.push(time);
      this.temperatureData.push(temperature);
      this.humidityData.push(humidity || null);
      //------ NEW --------
      this.phData.push(ph || null);
      this.precipitateData.push(precipitate || null);

      if (this.timeData.length > this.maxLen) {
        this.timeData.shift();
        this.temperatureData.shift();
        this.humidityData.shift();

        //------ NEW --------
        this.phData.shift(); 
        this.precipitateData.shift(); 
      }
    }
  }

  // All the devices in the list (those that have been sending telemetry)
  class TrackedDevices {
    constructor() {
      this.devices = [];
    }

    // Find a device based on its Id
    findDevice(deviceId) {
      for (let i = 0; i < this.devices.length; ++i) {
        if (this.devices[i].deviceId === deviceId) {
          return this.devices[i];
        }
      }

      return undefined;
    }

    getDevicesCount() {
      return this.devices.length;
    }
  }

  const trackedDevices = new TrackedDevices();

  // Define the chart axes
  const chartData = {
    datasets: [
      {
        fill: false,
        label: 'ph', // New
        yAxisID: 'ph', // New
        borderColor: 'rgba(75, 192, 192, 1)', // New
        pointBoarderColor: 'rgba(75, 192, 192, 1)', // New
        backgroundColor: 'rgba(75, 192, 192, 0.4)', // New
        pointHoverBackgroundColor: 'rgba(75, 192, 192, 1)', // New
        pointHoverBorderColor: 'rgba(75, 192, 192, 1)', // New
        spanGaps: true, // New
      },
      {
        fill: false,
        label: 'precipitate', // New
        yAxisID: 'precipitate', // New
        borderColor: 'rgba(255, 99, 132, 1)', // New
        pointBoarderColor: 'rgba(255, 99, 132, 1)', // New
        backgroundColor: 'rgba(255, 99, 132, 0.4)', // New
        pointHoverBackgroundColor: 'rgba(255, 99, 132, 1)', // New
        pointHoverBorderColor: 'rgba(255, 99, 132, 1)', // New
        spanGaps: true, // New
      }
    ]
  };

  const chartOptions = {
    scales: {
      yAxes: [
      {
        id: 'ph', // New
        type: 'linear', // New
        scaleLabel: { // New
          labelString: 'ph', // New
          display: true, // New
        }, // New
        position: 'left', // New
      }, // New
      {
        id: 'precipitate', // New
        type: 'linear', // New
        scaleLabel: { // New
          labelString: 'precipitate', // New
          display: true, // New
        }, // New
        position: 'right', // New
      } // New
    ]
    }
  };

  // Get the context of the canvas element we want to select
  const ctx = document.getElementById('iotChart').getContext('2d');
  const myLineChart = new Chart(
    ctx,
    {
      type: 'line',
      data: chartData,
      options: chartOptions,
    });

  // Manage a list of devices in the UI, and update which device data the chart is showing
  // based on selection
  let needsAutoSelect = true;
  const deviceCount = document.getElementById('deviceCount');
  const listOfDevices = document.getElementById('listOfDevices');
  function OnSelectionChange() {
    const device = trackedDevices.findDevice(listOfDevices[listOfDevices.selectedIndex].text);
    chartData.labels = device.timeData;
    chartData.datasets[0].data = device.temperatureData;
    chartData.datasets[1].data = device.humidityData;
    myLineChart.update();
  }
  listOfDevices.addEventListener('change', OnSelectionChange, false);

  // When a web socket message arrives:
  // 1. Unpack it
  // 2. Validate it has date/time and temperature
  // 3. Find or create a cached device to hold the telemetry data
  // 4. Append the telemetry data
  // 5. Update the chart UI
  webSocket.onmessage = function onMessage(message) {
    try {
      const messageData = JSON.parse(message.data);
      console.log(messageData);

      // time and either temperature or humidity are required
      if (!messageData.MessageDate || (!messageData.ph && !messageData.precipitate)) {
        return;
      }

      // find or add device to list of tracked devices
      const existingDeviceData = trackedDevices.findDevice(messageData.DeviceId);

      if (existingDeviceData) {
        existingDeviceData.addData(
          messageData.MessageDate,
           messageData.ph, 
          messageData.precipitate 
        );
      } else {
        const newDeviceData = new DeviceData(messageData.DeviceId);
        trackedDevices.devices.push(newDeviceData);
        const numDevices = trackedDevices.getDevicesCount();
        deviceCount.innerText = numDevices === 1 ? `${numDevices} device` : `${numDevices} devices`;
        newDeviceData.addData(
          messageData.MessageDate,
          messageData.ph,
          messageData.precipitate
        );

        // add device to the UI list
        const node = document.createElement('option');
        const nodeText = document.createTextNode(messageData.DeviceId);
        node.appendChild(nodeText);
        listOfDevices.appendChild(node);

        // if this is the first device being discovered, auto-select it
        if (needsAutoSelect) {
          needsAutoSelect = false;
          listOfDevices.selectedIndex = 0;
          OnSelectionChange();
        }
      }

      myLineChart.update();
    } catch (err) {
      console.error(err);
    }
  };
});
