import { PrayerService } from "../PrayerService";

// Mock adhan
jest.mock("adhan", () => {
  // Define prayer times in UTC
  const mockPrayerTimes = {
    fajr: new Date("2024-02-10T05:30:00Z"),
    dhuhr: new Date("2024-02-10T12:30:00Z"),
    asr: new Date("2024-02-10T15:45:00Z"),
    maghrib: new Date("2024-02-10T18:15:00Z"),
    isha: new Date("2024-02-10T19:45:00Z"),
  };

  return {
    Coordinates: jest.fn().mockImplementation((lat, lng) => ({
      latitude: lat,
      longitude: lng,
    })),
    PrayerTimes: jest.fn().mockImplementation(() => mockPrayerTimes),
    CalculationMethod: {
      UmmAlQura: () => ({
        methodParams: {
          fajr: 18.5,
          isha: 90,
        },
      }),
    },
  };
});

describe("PrayerService", () => {
  let prayerService: PrayerService;
  const libyaConfig = {
    latitude: 32.8872,
    longitude: 13.1913,
    timeZone: "Africa/Tripoli",
    prayerWindowMinutes: 30,
  };

  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    // Clear previous mocks
    jest.clearAllMocks();

    // Mock toLocaleString to handle timezone conversion
    const mockToLocaleString = jest.spyOn(Date.prototype, "toLocaleString");
    mockToLocaleString.mockImplementation(function (this: Date) {
      // Convert UTC to Libya time (UTC+2)
      const utcTime = this.getTime();
      const libyaTime = new Date(utcTime + 2 * 60 * 60 * 1000);
      return libyaTime.toISOString();
    });

    // Set default test time
    jest.setSystemTime(new Date("2024-02-10T14:00:00Z"));

    prayerService = new PrayerService(libyaConfig);
  });

  afterEach(() => {
    if (prayerService) {
      prayerService.cleanup();
    }
  });

  describe("prayer time calculations", () => {
    it("should calculate next prayer correctly during morning", () => {
      // 08:00 UTC = 10:00 Libya time
      jest.setSystemTime(new Date("2024-02-10T08:00:00Z"));
      const nextPrayer = prayerService.getNextPrayer();
      expect(nextPrayer.name).toBe("Dhuhr");
      expect(nextPrayer.time).toEqual(new Date("2024-02-10T12:30:00Z"));
    });

    it("should calculate next prayer correctly during afternoon", () => {
      // 14:00 UTC = 16:00 Libya time
      jest.setSystemTime(new Date("2024-02-10T14:00:00Z"));
      const nextPrayer = prayerService.getNextPrayer();
      expect(nextPrayer.name).toBe("Maghrib");
      expect(nextPrayer.time).toEqual(new Date("2024-02-10T18:15:00Z"));
    });

    it("should handle prayer time transition at midnight", () => {
      // 21:59 UTC = 23:59 Libya time
      jest.setSystemTime(new Date("2024-02-10T21:59:00Z"));
      const beforeMidnight = prayerService.getNextPrayer();
      expect(beforeMidnight.name).toBe("Fajr");

      // Move to midnight Libya time
      jest.setSystemTime(new Date("2024-02-10T22:00:00Z"));
      jest.advanceTimersByTime(60000);

      const afterMidnight = prayerService.getNextPrayer();
      expect(afterMidnight.name).toBe("Fajr");
      expect(afterMidnight.time).toEqual(new Date("2024-02-11T05:30:00Z"));
    });
  });

  describe("prayer windows", () => {
    beforeEach(() => {
      // Reset for each test
      jest.clearAllMocks();

      // Mock toLocaleString to handle timezone conversion
      jest
        .spyOn(Date.prototype, "toLocaleString")
        .mockImplementation(function (this: Date) {
          // Convert UTC to Libya time (UTC+2)
          const utcTime = this.getTime();
          const libyaTime = new Date(utcTime + 2 * 60 * 60 * 1000);
          return libyaTime.toISOString();
        });
    });

    describe("Asr prayer window", () => {
      const asrTime = new Date("2024-02-10T15:45:00Z"); // Asr prayer time

      it("should detect exactly at prayer time", () => {
        jest.setSystemTime(asrTime);
        prayerService = new PrayerService(libyaConfig);
        expect(prayerService.isInPrayerTime()).toBe(true);
      });

      it("should detect 10 minutes before prayer time", () => {
        const tenMinBefore = new Date(asrTime);
        tenMinBefore.setMinutes(tenMinBefore.getMinutes() - 10);
        jest.setSystemTime(tenMinBefore);
        prayerService = new PrayerService(libyaConfig);
        expect(prayerService.isInPrayerTime()).toBe(true);
      });

      it("should detect 11 minutes before prayer time as outside window", () => {
        const elevenMinBefore = new Date(asrTime);
        elevenMinBefore.setMinutes(elevenMinBefore.getMinutes() - 11);
        jest.setSystemTime(elevenMinBefore);
        prayerService = new PrayerService(libyaConfig);
        expect(prayerService.isInPrayerTime()).toBe(false);
      });

      it("should detect within post-prayer window", () => {
        const fiveMinAfter = new Date(asrTime);
        fiveMinAfter.setMinutes(fiveMinAfter.getMinutes() + 5);
        jest.setSystemTime(fiveMinAfter);
        prayerService = new PrayerService(libyaConfig);
        expect(prayerService.isInPrayerTime()).toBe(true);
      });

      it("should respect custom window duration", () => {
        const customService = new PrayerService({
          ...libyaConfig,
          prayerWindowMinutes: 15,
        });

        // Test 20 minutes after (should be outside 15-minute window)
        const twentyMinAfter = new Date(asrTime);
        twentyMinAfter.setMinutes(twentyMinAfter.getMinutes() + 20);
        jest.setSystemTime(twentyMinAfter);
        expect(customService.isInPrayerTime()).toBe(false);

        customService.cleanup();
      });
    });

    describe("Between prayers", () => {
      it("should detect time between prayers as outside window", () => {
        // Set time to halfway between Asr and Maghrib
        const betweenPrayers = new Date("2024-02-10T17:00:00Z");
        jest.setSystemTime(betweenPrayers);
        prayerService = new PrayerService(libyaConfig);
        expect(prayerService.isInPrayerTime()).toBe(false);
      });
    });
  });

  describe("cleanup", () => {
    it("should properly clean up interval", () => {
      const clearIntervalSpy = jest
        .spyOn(global, "clearInterval")
        .mockImplementation();

      prayerService.cleanup();
      expect(clearIntervalSpy).toHaveBeenCalled();

      clearIntervalSpy.mockRestore();
    });
  });
});
