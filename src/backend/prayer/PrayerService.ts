import { Prayer, PrayerConfig } from "@/shared/types/Prayer";
import { Coordinates, CalculationMethod, PrayerTimes } from "adhan";

export class PrayerService {
  private coordinates: Coordinates;
  private buffer: { before: number; after: number };

  constructor(config?: PrayerConfig) {
    // Default to Mecca coordinates if none provided
    this.coordinates = new Coordinates(
      config?.coordinates.latitude ?? 21.422487,
      config?.coordinates.longitude ?? 39.826206
    );

    // Default buffer times (15 mins before, 15 mins after)
    this.buffer = {
      before: config?.buffer.before ?? 15,
      after: config?.buffer.after ?? 15,
    };
  }

  getPrayerTimes(date: Date): PrayerTimes {
    return new PrayerTimes(
      this.coordinates,
      date,
      CalculationMethod.UmmAlQura()
    );
  }

  async isInPrayerTime(date: Date): Promise<boolean> {
    const prayerTimes = this.getPrayerTimes(date);
    const prayers = [
      prayerTimes.fajr,
      prayerTimes.dhuhr,
      prayerTimes.asr,
      prayerTimes.maghrib,
      prayerTimes.isha,
    ];

    for (const prayerTime of prayers) {
      const prayerStart = new Date(prayerTime);
      prayerStart.setMinutes(prayerStart.getMinutes() - this.buffer.before);

      const prayerEnd = new Date(prayerTime);
      prayerEnd.setMinutes(prayerEnd.getMinutes() + this.buffer.after);

      if (date >= prayerStart && date <= prayerEnd) {
        return true;
      }
    }

    return false;
  }

  async getNextPrayer(
    date: Date = new Date()
  ): Promise<{ name: Prayer; time: Date }> {
    // Get the prayer times for the current calendar day
    const currentPrayerTimes = this.getPrayerTimes(date);
    // Build an array of prayers (we then sort chronologically)
    const prayers = [
      { name: Prayer.Fajr, time: currentPrayerTimes.fajr },
      { name: Prayer.Dhuhr, time: currentPrayerTimes.dhuhr },
      { name: Prayer.Asr, time: currentPrayerTimes.asr },
      { name: Prayer.Maghrib, time: currentPrayerTimes.maghrib },
      { name: Prayer.Isha, time: currentPrayerTimes.isha },
    ].sort((a, b) => a.time.getTime() - b.time.getTime());

    // Normally, return the first prayer whose time is after the provided date.
    let nextPrayer = prayers.find((prayer) => prayer.time > date);

    /* 
      HOWEVER, if the provided time is very early (e.g. before 5 AM)
      then it might be the case that we’re in the period after the previous day’s Isha.
      In that situation, even if getPrayerTimes(date) returns a Fajr later that morning,
      we want to “roll over” and return the Fajr for the day after.
    */
    if (nextPrayer && nextPrayer.name === Prayer.Fajr && date.getHours() < 5) {
      // Compute yesterday’s prayer times (using the provided date)
      const yesterday = new Date(date);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayPrayerTimes = this.getPrayerTimes(yesterday);
      // If the provided time is after yesterday’s Isha, then we consider it "after Isha"
      if (date > yesterdayPrayerTimes.isha) {
        // Instead, use the prayer times for tomorrow (relative to the provided date)
        const tomorrow = new Date(date);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowPrayerTimes = this.getPrayerTimes(tomorrow);
        return { name: Prayer.Fajr, time: tomorrowPrayerTimes.fajr };
      }
    }

    // If we found a next prayer in the current schedule, return it.
    if (nextPrayer) {
      return nextPrayer;
    }

    // Fallback: if no prayer is found (for example, if the time is after Isha)
    // then get tomorrow’s Fajr.
    const tomorrow = new Date(date);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const tomorrowPrayerTimes = this.getPrayerTimes(tomorrow);
    return { name: Prayer.Fajr, time: tomorrowPrayerTimes.fajr };
  }

  async getPrayerWindows(
    date: Date
  ): Promise<Array<{ start: Date; end: Date }>> {
    const prayerTimes = this.getPrayerTimes(date);
    const prayers = [
      prayerTimes.fajr,
      prayerTimes.dhuhr,
      prayerTimes.asr,
      prayerTimes.maghrib,
      prayerTimes.isha,
    ];

    return prayers.map((prayerTime) => {
      const start = new Date(prayerTime);
      start.setMinutes(start.getMinutes() - this.buffer.before);

      const end = new Date(prayerTime);
      end.setMinutes(end.getMinutes() + this.buffer.after);

      return { start, end };
    });
  }

  async isValidBusinessHour(date: Date): Promise<boolean> {
    // Get the hour in 24-hour format
    const hour = date.getHours();

    // Example: Business hours are 9 AM to 11 PM
    if (hour < 9 || hour >= 23) {
      return false;
    }

    // Check if it's not during prayer time
    return !(await this.isInPrayerTime(date));
  }

  async getNextAvailableTime(date: Date = new Date()): Promise<Date> {
    let checkTime = new Date(date);

    while (!(await this.isValidBusinessHour(checkTime))) {
      // If outside business hours, move to next day at opening time
      if (checkTime.getHours() < 9 || checkTime.getHours() >= 23) {
        checkTime.setDate(checkTime.getDate() + 1);
        checkTime.setHours(9, 0, 0, 0);
        continue;
      }

      // If during prayer time, get the next prayer end time + buffer
      const prayerWindows = await this.getPrayerWindows(checkTime);
      const currentPrayerWindow = prayerWindows.find(
        (window) => checkTime >= window.start && checkTime <= window.end
      );

      if (currentPrayerWindow) {
        checkTime = new Date(currentPrayerWindow.end);
        checkTime.setMinutes(checkTime.getMinutes() + 1);
      }
    }

    return checkTime;
  }
}
