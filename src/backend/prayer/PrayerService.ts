import { PrayerTimes, Coordinates, CalculationMethod } from "adhan";

interface PrayerConfig {
  latitude: number;
  longitude: number;
  timeZone: string;
  prayerWindowMinutes?: number;
}

interface Prayer {
  name: string;
  time: Date;
}

export class PrayerService {
  private coordinates: Coordinates;
  private timeZone: string;
  private prayerWindowMinutes: number;
  private prayerTimes: PrayerTimes | null = null;
  private updateInterval: NodeJS.Timer | null = null;

  constructor(config: PrayerConfig) {
    this.coordinates = new Coordinates(config.latitude, config.longitude);
    this.timeZone = config.timeZone;
    this.prayerWindowMinutes = config.prayerWindowMinutes ?? 30;
    this.updatePrayerTimes();
    this.startDailyUpdate();
  }

  private updatePrayerTimes(): void {
    const date = new Date();
    // Use timeZone in date calculation
    const localDate = new Date(
      date.toLocaleString("en-US", { timeZone: this.timeZone })
    );
    this.prayerTimes = new PrayerTimes(
      this.coordinates,
      localDate,
      CalculationMethod.UmmAlQura()
    );
  }

  private startDailyUpdate(): void {
    this.updateInterval = setInterval(() => {
      const now = new Date();
      const localNow = new Date(
        now.toLocaleString("en-US", { timeZone: this.timeZone })
      );
      if (localNow.getHours() === 0 && localNow.getMinutes() === 0) {
        this.updatePrayerTimes();
      }
    }, 60000);
  }

  public getNextPrayer(): Prayer {
    if (!this.prayerTimes) {
      this.updatePrayerTimes();
    }

    const now = new Date();
    const localNow = new Date(
      now.toLocaleString("en-US", { timeZone: this.timeZone })
    );

    const prayers: Prayer[] = [
      { name: "Fajr", time: this.prayerTimes!.fajr },
      { name: "Dhuhr", time: this.prayerTimes!.dhuhr },
      { name: "Asr", time: this.prayerTimes!.asr },
      { name: "Maghrib", time: this.prayerTimes!.maghrib },
      { name: "Isha", time: this.prayerTimes!.isha },
    ];

    const nextPrayer = prayers.find((prayer) => prayer.time > localNow);
    return (
      nextPrayer || {
        ...prayers[0],
        time: this.getNextDayPrayer(prayers[0].time),
      }
    );
  }

  private getNextDayPrayer(time: Date): Date {
    const nextDay = new Date(time);
    nextDay.setDate(nextDay.getDate() + 1);
    return nextDay;
  }

  public isInPrayerTime(time?: Date): boolean {
    if (!this.prayerTimes) {
      this.updatePrayerTimes();
    }

    const checkTime = time || new Date();
    const localCheckTime = new Date(
      checkTime.toLocaleString("en-US", { timeZone: this.timeZone })
    );

    // Get all prayer times for the day
    const prayers = [
      { name: "Fajr", time: this.prayerTimes!.fajr },
      { name: "Dhuhr", time: this.prayerTimes!.dhuhr },
      { name: "Asr", time: this.prayerTimes!.asr },
      { name: "Maghrib", time: this.prayerTimes!.maghrib },
      { name: "Isha", time: this.prayerTimes!.isha },
    ];

    // Check each prayer time
    for (const prayer of prayers) {
      // Convert prayer time to local time zone
      const prayerTime = new Date(
        prayer.time.toLocaleString("en-US", { timeZone: this.timeZone })
      );

      // Calculate window boundaries
      const windowStart = new Date(prayerTime);
      windowStart.setMinutes(windowStart.getMinutes() - 10);

      const windowEnd = new Date(prayerTime);
      windowEnd.setMinutes(windowEnd.getMinutes() + this.prayerWindowMinutes);

      // Check if current time is within this prayer's window
      if (localCheckTime >= windowStart && localCheckTime <= windowEnd) {
        return true;
      }
    }

    return false;
  }

  public cleanup(): void {
    if (this.updateInterval) {
      clearInterval(Number(this.updateInterval));
    }
  }
}
