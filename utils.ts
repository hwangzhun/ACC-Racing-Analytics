import {
  getCarClassByModelId,
  type AccResultData,
  type LeaderboardLine,
  type Penalty,
} from './types';

/** 低于 1 秒的 penaltyValue（如 DriveThrough 导出 +0:00.001）不计入 JSON 罚时汇总，罚则条目仍保留展示。 */
export const JSON_TIME_PENALTY_SUM_MIN_MS = 1000;

/** PostRaceTime、none 等不参与罚时汇总、排行榜徽标、车号高亮与详情罚则列表 */
export function isIgnoredJsonPenaltyType(penalty: string): boolean {
  const key = penalty.trim();
  if (!key) return true;
  const lower = key.toLowerCase();
  if (lower === 'none') return true;
  if (lower === 'postracetime') return true;
  return false;
}

/**
 * 汇总 JSON 中该车非 DSQ 的时间罚（毫秒）；仅计入 penaltyValue >= 1s 的条目。
 */
export function sumJsonTimePenaltyMs(carId: number, penalties: Penalty[]): number {
  return penalties.reduce((acc, p) => {
    if (p.carId !== carId) return acc;
    if (p.penalty === 'Disqualified') return acc;
    if (isIgnoredJsonPenaltyType(p.penalty)) return acc;
    const v = p.penaltyValue;
    if (typeof v !== 'number' || v < JSON_TIME_PENALTY_SUM_MIN_MS) return acc;
    return acc + v;
  }, 0);
}

/** 是否存在任意手动罚时（用于正赛是否按含罚时重排名） */
export function hasAnyManualPenaltyMs(manualPenaltyMsByCarId: Record<number, number>): boolean {
  return Object.values(manualPenaltyMsByCarId).some((ms) => ms > 0);
}

/** 正赛：官方 totalTime + JSON 计入罚时 + 手动罚时；无效完赛或 DSQ 前勿用 null 参与排序比较 */
export function getRaceAdjustedFinishMs(
  line: LeaderboardLine,
  penalties: Penalty[],
  manualPenaltyMsByCarId: Record<number, number>
): number | null {
  const tt = line.timing.totalTime;
  if (!tt || tt === 2147483647) return null;
  const cid = line.car.carId;
  return tt + sumJsonTimePenaltyMs(cid, penalties) + Math.max(0, manualPenaltyMsByCarId[cid] ?? 0);
}

function isCarDisqualified(carId: number, penalties: Penalty[]): boolean {
  return penalties.some((p) => p.carId === carId && p.penalty === 'Disqualified');
}

function getRaceAdjustedFinishMsForRanking(
  line: LeaderboardLine,
  penalties: Penalty[],
  manualPenaltyMsByCarId: Record<number, number>
): number {
  const adjusted = getRaceAdjustedFinishMs(line, penalties, manualPenaltyMsByCarId);
  return adjusted == null ? Number.POSITIVE_INFINITY : adjusted;
}

/**
 * 与排行榜一致：正赛在存在任意手动罚时时，按含罚时完赛升序重排（DSQ 仍置后）；否则保持 JSON 顺序。
 */
export function sortLeaderboardLinesForDisplay(
  lines: LeaderboardLine[],
  sessionType: string,
  penalties: Penalty[],
  manualPenaltyMsByCarId: Record<number, number>
): LeaderboardLine[] {
  if (sessionType !== 'R') {
    return [...lines].sort((a, b) => a.timing.bestLap - b.timing.bestLap);
  }
  if (!hasAnyManualPenaltyMs(manualPenaltyMsByCarId)) {
    return [...lines];
  }

  const indexed = lines.map((line, origIndex) => ({ line, origIndex }));
  indexed.sort((A, B) => {
    const a = A.line;
    const b = B.line;
    const da = isCarDisqualified(a.car.carId, penalties);
    const db = isCarDisqualified(b.car.carId, penalties);
    if (da !== db) return da ? 1 : -1;

    const adjA = getRaceAdjustedFinishMs(a, penalties, manualPenaltyMsByCarId);
    const adjB = getRaceAdjustedFinishMs(b, penalties, manualPenaltyMsByCarId);

    if (!da) {
      if (adjA !== null && adjB !== null && adjA !== adjB) return adjA - adjB;
      if (adjA === null && adjB !== null) return 1;
      if (adjA !== null && adjB === null) return -1;
    }
    return A.origIndex - B.origIndex;
  });

  return indexed.map((x) => x.line);
}

export interface LeaderboardAnomaly {
  type: 'lap_count_order' | 'adjusted_time_order';
  frontCarId: number;
  behindCarId: number;
  frontRaceNumber: number;
  behindRaceNumber: number;
  message: string;
}

/**
 * 正赛重排：DSQ 最后；非 DSQ 按圈数降序，再按含罚时完赛升序；最终按原始顺序稳定。
 */
export function rerankLeaderboardByRaceRules(
  lines: LeaderboardLine[],
  sessionType: string,
  penalties: Penalty[],
  manualPenaltyMsByCarId: Record<number, number>
): LeaderboardLine[] {
  if (sessionType !== 'R') return sortLeaderboardLinesForDisplay(lines, sessionType, penalties, manualPenaltyMsByCarId);

  const indexed = lines.map((line, origIndex) => ({ line, origIndex }));
  indexed.sort((A, B) => {
    const a = A.line;
    const b = B.line;
    const da = isCarDisqualified(a.car.carId, penalties);
    const db = isCarDisqualified(b.car.carId, penalties);
    if (da !== db) return da ? 1 : -1;
    if (da && db) return A.origIndex - B.origIndex;

    const lapDiff = b.timing.lapCount - a.timing.lapCount;
    if (lapDiff !== 0) return lapDiff;

    const adjA = getRaceAdjustedFinishMsForRanking(a, penalties, manualPenaltyMsByCarId);
    const adjB = getRaceAdjustedFinishMsForRanking(b, penalties, manualPenaltyMsByCarId);
    if (adjA !== adjB) return adjA - adjB;

    return A.origIndex - B.origIndex;
  });
  return indexed.map((x) => x.line);
}

/**
 * 检测当前展示顺序中的正赛异常：圈数逆序、同圈数含罚时完赛逆序（均忽略 DSQ）。
 */
export function detectLeaderboardAnomalies(
  lines: LeaderboardLine[],
  sessionType: string,
  penalties: Penalty[],
  manualPenaltyMsByCarId: Record<number, number>
): LeaderboardAnomaly[] {
  if (sessionType !== 'R' || lines.length < 2) return [];

  const anomalies: LeaderboardAnomaly[] = [];
  for (let i = 0; i < lines.length - 1; i += 1) {
    const front = lines[i];
    const behind = lines[i + 1];
    if (isCarDisqualified(front.car.carId, penalties) || isCarDisqualified(behind.car.carId, penalties)) {
      continue;
    }

    if (front.timing.lapCount < behind.timing.lapCount) {
      anomalies.push({
        type: 'lap_count_order',
        frontCarId: front.car.carId,
        behindCarId: behind.car.carId,
        frontRaceNumber: front.car.raceNumber,
        behindRaceNumber: behind.car.raceNumber,
        message: `#${front.car.raceNumber} 圈数少于 #${behind.car.raceNumber}`,
      });
      continue;
    }

    if (front.timing.lapCount === behind.timing.lapCount) {
      const frontAdj = getRaceAdjustedFinishMsForRanking(front, penalties, manualPenaltyMsByCarId);
      const behindAdj = getRaceAdjustedFinishMsForRanking(behind, penalties, manualPenaltyMsByCarId);
      if (frontAdj > behindAdj) {
        anomalies.push({
          type: 'adjusted_time_order',
          frontCarId: front.car.carId,
          behindCarId: behind.car.carId,
          frontRaceNumber: front.car.raceNumber,
          behindRaceNumber: behind.car.raceNumber,
          message: `#${front.car.raceNumber} 与 #${behind.car.raceNumber} 同圈但完赛更慢`,
        });
      }
    }
  }
  return anomalies;
}

/**
 * 排行榜/徽标用：由 JSON 完整 penalty 字段生成短标签。
 * DriveThrough → DT；StopAndGo_30 → SG30（从完整字符串解析秒数）；其余类型原样返回。
 */
export function formatPenaltyTypeLabel(penalty: string): string {
  if (penalty === 'DriveThrough') return 'DT';
  const sg = /^StopAndGo_(\d+)$/i.exec(penalty);
  if (sg) return `SG${sg[1]}`;
  if (penalty === 'StopAndGo') return 'SG';
  return penalty;
}

/** 该车在会话中的非 DSQ 罚则（用于高亮与排名格展示），标签已去重且保持首次出现顺序 */
export function getCarSessionPenaltyBadgeLabels(carId: number, penalties: Penalty[]): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const p of penalties) {
    if (p.carId !== carId) continue;
    if (p.penalty === 'Disqualified') continue;
    if (isIgnoredJsonPenaltyType(p.penalty)) continue;
    const label = formatPenaltyTypeLabel(p.penalty);
    if (seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
  }
  return labels;
}

/** 是否存在至少一条非 DSQ 的 JSON 罚则（含 DriveThrough 等） */
export function carHasNonDsqJsonPenalties(carId: number, penalties: Penalty[]): boolean {
  return penalties.some(
    (p) =>
      p.carId === carId &&
      p.penalty !== 'Disqualified' &&
      !isIgnoredJsonPenaltyType(p.penalty)
  );
}

/** 罚时展示：无罚时为 —，否则为 +m:ss.SSS（与圈速风格一致） */
export function formatPenaltyDelta(ms: number): string {
  if (!ms || ms <= 0) return '—';
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;
  return `+${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
}

/**
 * Formats milliseconds into m:ss.SSS
 * e.g., 138217 -> 2:18.217
 */
export const formatTime = (ms: number): string => {
  if (ms === 2147483647 || !ms) return "-:--.---";
  
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;

  return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
};

/**
 * Formats milliseconds into a short string for charts (e.g. 2:18.2)
 */
export const formatTimeShort = (ms: number): string => {
    if (!ms || ms > 1000000) return "";
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = Math.floor((ms % 1000) / 100); 
  
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds}`;
};

/**
 * Calculates the gap between two times in format +s.SSS
 */
export const formatGap = (currentMs: number, leaderMs: number): string => {
    if(currentMs === leaderMs) return "-";
    if(currentMs === 2147483647 || !currentMs || !leaderMs) return "";
    
    const diff = currentMs - leaderMs;
    const seconds = Math.floor(diff / 1000);
    const milliseconds = diff % 1000;
    
    return `+${seconds}.${milliseconds.toString().padStart(3, '0')}`;
}

export const getSectorColor = (sectorTime: number, bestSectorTime: number, sessionBestSectorTime: number) => {
    if (sectorTime <= sessionBestSectorTime) return "text-purple-400 font-bold";
    if (sectorTime <= bestSectorTime) return "text-green-400 font-bold";
    return "text-slate-300";
}

/**
 * ACC 部分结果 JSON 为 UTF-16 LE（无 BOM 或带 FF FE），按 UTF-8 读取会导致 JSON.parse 失败。
 */
export function decodeAccResultFileText(arrayBuffer: ArrayBuffer): string {
  const u8 = new Uint8Array(arrayBuffer);
  if (u8.length === 0) return '';

  if (u8.length >= 3 && u8[0] === 0xef && u8[1] === 0xbb && u8[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(arrayBuffer.slice(3));
  }
  if (u8.length >= 2 && u8[0] === 0xff && u8[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(arrayBuffer.slice(2));
  }
  if (u8.length >= 2 && u8[0] === 0xfe && u8[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(arrayBuffer.slice(2));
  }
  if (u8.length >= 4 && u8[0] === 0x7b && u8[1] === 0x00) {
    return new TextDecoder('utf-16le').decode(arrayBuffer);
  }
  if (u8.length >= 4 && u8[0] === 0x00 && u8[1] === 0x7b) {
    return new TextDecoder('utf-16be').decode(arrayBuffer);
  }
  return new TextDecoder('utf-8').decode(arrayBuffer);
}

/** 去掉 UTF-8 BOM、首尾空白，避免合法 JSON 因 BOM 导致 parse 失败 */
export function normalizeJsonText(raw: string): string {
  return raw.replace(/^\uFEFF/, '').trim();
}

export function parseAccResultArrayBuffer(buf: ArrayBuffer): AccResultData {
  const text = normalizeJsonText(decodeAccResultFileText(buf));
  if (!text) {
    throw new Error('EMPTY_FILE');
  }
  return JSON.parse(text) as AccResultData;
}

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result;
      if (r instanceof ArrayBuffer) resolve(r);
      else reject(new Error('READ_FAILED'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('READ_FAILED'));
    reader.readAsArrayBuffer(file);
  });
}

/** 读取本地 .json（含 UTF-16 LE 等）并解析为 ACC 结果对象 */
export async function readAccResultJsonFile(file: File): Promise<AccResultData> {
  const buf = await readFileAsArrayBuffer(file);
  return parseAccResultArrayBuffer(buf);
}

export function dragEventHasFiles(e: { dataTransfer: DataTransfer | null }): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes('Files');
}

export function alertAccResultFileError(err: unknown): void {
  console.error('ACC result file error', err);
  const detail = err instanceof Error ? err.message : String(err);
  if (detail === 'EMPTY_FILE') {
    alert('文件为空，请选择有效的 ACC 结果 JSON。');
    return;
  }
  if (detail === 'READ_FAILED') {
    alert('读取文件失败，请重试或检查文件是否被其他程序占用。');
    return;
  }
  alert(
    `解析 JSON 失败（不是合法 JSON 语法）。\n\n常见原因：选错文件、文件损坏；若用记事本「另存为 Unicode」保存过，多为 UTF-16，本应用已尝试自动识别。\n\n请尽量使用服务器生成的原始 *_R.json 等文件。\n\n技术详情：${detail}`
  );
}

/** UI 标签样式（组别来自 getCarClassByModelId，与 JSON carGroup 无关） */
export function carClassBadgeClass(cls: string | null | undefined): string {
  if (!cls) return 'bg-slate-800 text-slate-400 border-slate-600';
  const g = cls.trim().toUpperCase();
  if (g === 'GT3') return 'bg-red-950/60 text-red-300 border-red-800/60';
  if (g === 'GT4') return 'bg-amber-950/50 text-amber-200 border-amber-800/50';
  if (g === 'GT2') return 'bg-blue-950/50 text-blue-200 border-blue-800/50';
  return 'bg-slate-800 text-slate-400 border-slate-600';
}

function sanitizeFilenamePart(value: string, fallback: string): string {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.replace(/[\\/:*?"<>|]/g, '_');
}

function formatExportDate(now = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function buildExportBaseName(serverName: string, trackName: string, sessionType: string): string {
  const safeServer = sanitizeFilenamePart(serverName, '未知服务器');
  const safeTrack = sanitizeFilenamePart(trackName, '未知赛道');
  const safeSessionType = sanitizeFilenamePart(sessionType || 'U', 'U');
  const datePart = formatExportDate();
  return `${safeServer}-${safeTrack}-${safeSessionType}-${datePart}`;
}

/**
 * 导出排行榜数据为 CSV 格式
 */
export const exportLeaderboardToCSV = (
    lines: any[],
    sessionType: string,
    penalties: Penalty[] = [],
    trackName: string = '',
    sessionName: string = '',
    carModels: Record<number, string> = {},
    manualPenaltyMsByCarId: Record<number, number> = {},
    preSortedLines?: LeaderboardLine[]
) => {
    const sortedLines = preSortedLines
        ? [...preSortedLines]
        : sortLeaderboardLinesForDisplay(
            lines,
            sessionType,
            penalties,
            manualPenaltyMsByCarId
        );

    const isDisqualified = (carId: number): boolean => {
        return penalties.some(p => p.carId === carId && p.penalty === 'Disqualified');
    };

    const getDSQReason = (carId: number): string | null => {
        const dsqPenalty = penalties.find(p => p.carId === carId && p.penalty === 'Disqualified');
        return dsqPenalty?.reason || null;
    };

    const isRace = sessionType === 'R';
    const anyManual = hasAnyManualPenaltyMs(manualPenaltyMsByCarId);
    const leaderLine =
        sortedLines.find((l) => !isDisqualified(l.car.carId)) ?? sortedLines[0];
    const referenceOfficialRace = leaderLine?.timing.totalTime ?? 0;
    const referenceBest = leaderLine?.timing.bestLap ?? 0;
    const referenceAdjusted =
        isRace && anyManual && leaderLine && !isDisqualified(leaderLine.car.carId)
            ? getRaceAdjustedFinishMs(leaderLine, penalties, manualPenaltyMsByCarId)
            : null;

    // CSV 表头
    const headers = [
        '排名',
        '车号',
        '主车手',
        '其他车手',
        '车型',
        '组别',
        sessionType === 'R' ? '完赛时间' : '最快圈',
        '差距',
        '系统(ms)',
        '手动罚时(ms)',
        '罚时合计(ms)',
        ...(isRace ? [anyManual ? '含罚时完赛' : '含罚时完赛(参考)'] : []),
        '圈数',
        '状态',
        '取消资格原因'
    ];

    // 构建 CSV 数据行
    const rows = sortedLines.map((line, index) => {
        const isDSQ = isDisqualified(line.car.carId);
        const dsqReason = getDSQReason(line.car.carId);
        const driverName = `${line.currentDriver.firstName} ${line.currentDriver.lastName}`.trim() || line.currentDriver.shortName;
        const otherDrivers = line.car.drivers
            .filter((d: any) => d.playerId !== line.currentDriver.playerId)
            .map((d: any) => `${d.firstName} ${d.lastName}`.trim() || d.shortName)
            .join(', ');
        const carName = carModels[line.car.carModel] || `车型 ${line.car.carModel}`;
        
        const timeValue = sessionType === 'R' ? line.timing.totalTime : line.timing.bestLap;
        let gap: string;
        if (isDSQ) {
            gap = '-';
        } else if (isRace && anyManual) {
            const curAdj = getRaceAdjustedFinishMs(line, penalties, manualPenaltyMsByCarId);
            if (curAdj != null && referenceAdjusted != null) {
                gap = formatGap(curAdj, referenceAdjusted);
            } else {
                gap = formatGap(timeValue, referenceOfficialRace);
            }
        } else {
            gap = formatGap(timeValue, isRace ? referenceOfficialRace : referenceBest);
        }
        const timeStr = formatTime(timeValue);
        const rank = isDSQ ? 'DSQ' : (index + 1).toString();
        const status = isDSQ ? '取消资格' : (index === 0 ? '冠军' : '');

        const cid = line.car.carId;
        const jsonPenaltyMs = sumJsonTimePenaltyMs(cid, penalties);
        const manualMs = Math.max(0, manualPenaltyMsByCarId[cid] ?? 0);
        const totalPenaltyMs = jsonPenaltyMs + manualMs;
        const totalTimeRaw = line.timing.totalTime;
        const withPenaltyStr =
            isRace && !isDSQ && totalTimeRaw && totalTimeRaw !== 2147483647
                ? formatTime(totalTimeRaw + totalPenaltyMs)
                : '-';

        return [
            rank,
            line.car.raceNumber.toString(),
            driverName,
            otherDrivers || '-',
            carName,
            getCarClassByModelId(line.car.carModel) ?? '-',
            timeStr,
            gap,
            String(jsonPenaltyMs),
            String(manualMs),
            String(totalPenaltyMs),
            ...(isRace ? [withPenaltyStr] : []),
            line.timing.lapCount.toString(),
            status,
            dsqReason || '-'
        ];
    });

    // 构建完整的 CSV 内容
    const csvContent = [
        // 元数据行（可选）
        ...(trackName || sessionName ? [`赛道: ${trackName || ''}, 会话: ${sessionName || ''}`] : []),
        // 表头
        headers.join(','),
        // 数据行
        ...rows.map(row => row.map(cell => {
            // 处理包含逗号、引号或换行符的单元格
            const cellStr = String(cell || '');
            if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                return `"${cellStr.replace(/"/g, '""')}"`;
            }
            return cellStr;
        }).join(','))
    ].join('\n');

    // 添加 BOM 以支持中文 Excel 正确显示
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // 文件名：服务器-赛道-P/R/Q-日期
    link.download = `${buildExportBaseName(sessionName, trackName, sessionType)}.csv`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

/** 导出当前完整会话数据为 JSON */
export function exportAllDataToJSON(
  payload: unknown,
  trackName: string = '',
  sessionType: string = '',
  serverName: string = ''
): void {
  const jsonText = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;

  // 文件名：服务器-赛道-P/R/Q-日期
  link.download = `${buildExportBaseName(serverName, trackName, sessionType)}.json`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
