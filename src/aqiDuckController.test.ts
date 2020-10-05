const monitorAggregator = jest.fn().mockImplementation(() => Promise.resolve('tick'))
jest.mock('./aggregator', () => {
  return {
    fromConfig: jest.fn().mockImplementation((config) => {
      return {
        report: jest.fn().mockImplementation(() => { return Promise.resolve(`I am a report for ${config}`) }),
        monitorAndNotify: monitorAggregator
      }
    }),
  };
});

jest.useFakeTimers();

const mockSlackReporterA = {
  postMessage: jest.fn(),
  getChannelName: () => "Reporter A",
  getConfig: jest.fn().mockImplementation(() => {
    return Promise.resolve("Mock config A");
  })
}

const mockSlackReporterB = {
  postMessage: jest.fn(),
  getChannelName: () => "Reporter B",
  getConfig: jest.fn().mockImplementation(() => {
    return Promise.resolve("Mock config B");
  })
}

jest.mock('./slackReporter', () => {
  return { subscribeAll: jest.fn().mockImplementation(() => {
    return Promise.resolve([mockSlackReporterA, mockSlackReporterB]);
  }) };
});

import AqiDuckController from './aqiDuckController';

function flushPromises() {
    return new Promise(resolve => setImmediate(resolve));
}

beforeEach(() => {
  mockSlackReporterA.postMessage.mockClear()
  mockSlackReporterB.postMessage.mockClear()
});

describe(".subscribeAll", () => {
  it('should report for each controller', async () => {
    expect.assertions(2);
    await AqiDuckController.subscribeAll();
    await flushPromises();
    expect(mockSlackReporterA.postMessage).toHaveBeenCalledWith("I am a report for Mock config A")
    expect(mockSlackReporterB.postMessage).toHaveBeenCalledWith("I am a report for Mock config B")
  });
});

describe("handleAppMention", () => {
  it("sends a report if the event text says report", async () => {
    const controller = new AqiDuckController(mockSlackReporterA);
    controller.handleAppMention({ text: '<@USERNAMETHING>REPORT' });
    expect(mockSlackReporterA.postMessage).toHaveBeenCalledWith("I'm not set up to give you a report!")
    mockSlackReporterA.postMessage.mockClear()
    await controller.setupAggregator();
    controller.handleAppMention({ text: '<@USERNAMETHING> report' });
    await flushPromises();
    expect(mockSlackReporterA.postMessage).toHaveBeenCalledWith("I am a report for Mock config A")
  });

  it("says hello if the event text says hello", async () => {
    const controller = new AqiDuckController(mockSlackReporterA);
    await controller.setupAggregator();

    mockSlackReporterA.postMessage.mockClear()
    controller.handleAppMention({ text: '<@USERNAMETHING> Hello' });
    await flushPromises();
    expect(mockSlackReporterA.postMessage).toHaveBeenCalledWith(expect.stringMatching("Hello there!"));

    mockSlackReporterA.postMessage.mockClear()
    controller.handleAppMention({ text: '<@USERNAMETHING> hi there' });
    await flushPromises();
    expect(mockSlackReporterA.postMessage).toHaveBeenCalledWith(expect.stringMatching("Hello there!"));

    mockSlackReporterA.postMessage.mockClear()
    controller.handleAppMention({ text: '<@USERNAMETHING> high' });
    await flushPromises();
    expect(mockSlackReporterA.postMessage).not.toHaveBeenCalledWith(expect.stringMatching("Hello there!"));
  });

  it("Stops reporting if you say stop monitoring, and resumes and reports when you say resume", async () => {
    const controller = new AqiDuckController(mockSlackReporterA);
    await controller.setupAggregator();
    controller.monitorAndNotify();
    jest.runOnlyPendingTimers();
    expect(monitorAggregator).toHaveBeenCalled();
    monitorAggregator.mockClear();
    mockSlackReporterA.postMessage.mockClear()
    controller.handleAppMention({ text: '<@USERNAMETHING> Stop monitoring' });
    jest.runOnlyPendingTimers();
    expect(monitorAggregator).not.toHaveBeenCalled();
    expect(mockSlackReporterA.postMessage).toHaveBeenCalledTimes(1);
    expect(mockSlackReporterA.postMessage).toHaveBeenCalledWith("Monitoring stopped.");
    mockSlackReporterA.postMessage.mockClear()
    controller.handleAppMention({ text: '<@USERNAMETHING> Resume monitoring' });
    jest.runOnlyPendingTimers();
    expect(monitorAggregator).toHaveBeenCalled();
    await flushPromises();
    expect(mockSlackReporterA.postMessage).toHaveBeenCalledWith("Monitoring resumed");
    expect(mockSlackReporterA.postMessage).toHaveBeenCalledWith("I am a report for Mock config A")
  });

  it("Doesn't stop monitoring if there's nothing to stop", async () => {
    const controller = new AqiDuckController(mockSlackReporterA);
    await controller.setupAggregator();
    controller.handleAppMention({ text: '<@USERNAMETHING> Stop monitoring' });
    await flushPromises();
    expect(mockSlackReporterA.postMessage).toHaveBeenCalledWith("Nothing to stop.")
  })

  it("Doesn't resume monitoring if there's a running timer", async () => {
    const controller = new AqiDuckController(mockSlackReporterA);
    await controller.setupAggregator();
    controller.monitorAndNotify();
    controller.handleAppMention({ text: '<@USERNAMETHING> Resume monitoring' });
    await flushPromises();
    expect(mockSlackReporterA.postMessage).toHaveBeenCalledWith("Monitoring is already running")
  })

  it("Doesn't resume monitoring if there's no aggregator set up", async () => {
    const controller = new AqiDuckController(mockSlackReporterA);
    controller.handleAppMention({ text: '<@USERNAMETHING> Resume monitoring' });
    await flushPromises();
    expect(mockSlackReporterA.postMessage).toHaveBeenCalledWith("Nothing to monitor")
  })

  it.todo("Reports dynamically if you tell it to with the phrase 'Dynamic AQI monitoring'");
  //controller.handleAppMention({ text: '<@USERNAMETHING> Dynamic AQI monitoring' });

  it.todo("Reports statically if you tell it to");
  //controller.handleAppMention({ text: '<@USERNAMETHING> Monitor AQI [40,50]' });

  it("Lets you know if the event text is unknown", async () => {
    const controller = new AqiDuckController(mockSlackReporterA);
    await controller.setupAggregator();
    controller.handleAppMention({ text: '<@USERNAMETHING> What' });
    await flushPromises();
    expect(mockSlackReporterA.postMessage).toHaveBeenCalledWith(expect.stringContaining("I'm not sure how to help with that."))
  });
});
