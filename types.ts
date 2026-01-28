export interface Driver {
  firstName: string;
  lastName: string;
  shortName: string;
  playerId: string;
}

export interface CarInfo {
  carId: number;
  raceNumber: number;
  carModel: number;
  cupCategory: number;
  carGroup: string;
  teamName: string;
  nationality: number;
  drivers: Driver[];
}

export interface Timing {
  lastLap: number;
  lastSplits: number[];
  bestLap: number;
  bestSplits: number[];
  totalTime: number;
  lapCount: number;
  lastSplitId: number;
}

export interface LeaderboardLine {
  car: CarInfo;
  currentDriver: Driver;
  currentDriverIndex: number;
  timing: Timing;
  missingMandatoryPitstop: number;
  driverTotalTimes: number[];
}

export interface Lap {
  carId: number;
  driverIndex: number;
  laptime: number;
  isValidForBest: boolean;
  splits: number[];
}

export interface Penalty {
  carId: number;
  driverIndex: number;
  reason: string;
  penalty: string;
  penaltyValue: number;
  violationInLap: number;
  clearedInLap: number;
}

export interface SessionResult {
  bestlap: number;
  bestSplits: number[];
  isWetSession: number;
  type: number;
  leaderBoardLines: LeaderboardLine[];
}

export interface AccResultData {
  sessionType: string;
  trackName: string;
  sessionIndex: number;
  raceWeekendIndex: number;
  metaData: string;
  serverName: string;
  sessionResult: SessionResult;
  laps: Lap[];
  penalties?: Penalty[];
  post_race_penalties?: Penalty[];
}

// Map ACC Car Model IDs to human readable names
// 基于 car_model.list 映射表
export const CAR_MODELS: Record<number, string> = {
  0: "Porsche 991 GT3",
  1: "Mercedes-AMG GT3",
  2: "Ferrari 488 GT3",
  3: "Audi R8 LMS GT3",
  4: "Lamborghini Huracan GT3",
  5: "McLaren 650S GT3",
  6: "Nissan GT-R Nismo GT3 (2018)",
  7: "BMW M6 GT3",
  8: "Bentley Continental GT3 (2018)",
  10: "Nissan GT-R Nismo GT3 (2017)",
  12: "Aston Martin V12 Vantage GT3", // 注意：Bentley Continental GT3 (2015) 也使用 ID 12，但优先使用第一个映射
  13: "Lamborghini Gallardo R-EX",
  14: "Jaguar Emil Frey G3",
  15: "Lexus RC F GT3",
  16: "Lamborghini Huracan GT3 Evo",
  17: "Honda NSX GT3",
  19: "Audi R8 LMS GT3 Evo",
  20: "Aston Martin V8 Vantage GT3",
  21: "Honda NSX Evo",
  22: "McLaren 720S GT3",
  23: "Porsche 911 II GT3 R",
  24: "Ferrari 488 GT3 Evo",
  25: "Mercedes-AMG GT3 (2020)",
  30: "BMW M4 GT3",
  31: "Audi R8 LMS GT3 Evo II",
  32: "Ferrari 296 GT3",
  33: "Lamborghini Huracan GT3 Evo II",
  34: "Porsche 992 GT3 R",
  35: "McLaren 720S GT3 EVO",
  36: "Ford Mustang GT3",
};