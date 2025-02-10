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
    this.prayerTimes = new PrayerTimes(
      this.coordinates,
      date,
      CalculationMethod.UmmAlQura() // Using UmmAlQura calculation method
    );
  }

  private startDailyUpdate(): void {
    // Update prayer times at midnight each day
    this.updateInterval = setInterval(() => {
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        this.updatePrayerTimes();
      }
    }, 60000); // Check every minute
  }

  public getNextPrayer(): Prayer {
    if (!this.prayerTimes) {
      this.updatePrayerTimes();
    }

    const now = new Date();
    const prayers: Prayer[] = [
      { name: "Fajr", time: this.prayerTimes!.fajr },
      { name: "Dhuhr", time: this.prayerTimes!.dhuhr },
      { name: "Asr", time: this.prayerTimes!.asr },
      { name: "Maghrib", time: this.prayerTimes!.maghrib },
      { name: "Isha", time: this.prayerTimes!.isha },
    ];

    const nextPrayer = prayers.find((prayer) => prayer.time > now);
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
    const checkTime = time || new Date();
    const nextPrayer = this.getNextPrayer();

    // Check if we're within the prayer window
    const prayerStart = new Date(nextPrayer.time);
    prayerStart.setMinutes(prayerStart.getMinutes() - 10); // 10 minutes before prayer

    const prayerEnd = new Date(nextPrayer.time);
    prayerEnd.setMinutes(prayerEnd.getMinutes() + this.prayerWindowMinutes);

    return checkTime >= prayerStart && checkTime <= prayerEnd;
  }

  public cleanup(): void {
    if (this.updateInterval) {
      clearInterval(Number(this.updateInterval));
    }
  }
}
