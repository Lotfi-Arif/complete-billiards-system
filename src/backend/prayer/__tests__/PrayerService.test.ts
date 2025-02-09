import { PrayerService } from "../PrayerService";

describe("PrayerService", () => {
  let prayerService: PrayerService;

  beforeEach(() => {
    prayerService = new PrayerService({
      latitude: 21.4225,
      longitude: 39.8262,
      timeZone: "Asia/Riyadh",
    });
  });

  afterEach(() => {
    prayerService.cleanup();
  });

  it("should get next prayer time", () => {
    const nextPrayer = prayerService.getNextPrayer();
    expect(nextPrayer).toHaveProperty("name");
    expect(nextPrayer).toHaveProperty("time");
    expect(nextPrayer.time).toBeInstanceOf(Date);
  });

  it("should properly detect prayer time windows", () => {
    // Mock current time to be during prayer
    const mockDate = new Date();
    const nextPrayer = prayerService.getNextPrayer();
    mockDate.setTime(nextPrayer.time.getTime());
    jest.setSystemTime(mockDate);

    expect(prayerService.isInPrayerTime()).toBe(true);

    // Mock current time to be outside prayer window
    mockDate.setHours(mockDate.getHours() + 2);
    jest.setSystemTime(mockDate);

    expect(prayerService.isInPrayerTime()).toBe(false);
  });
});
