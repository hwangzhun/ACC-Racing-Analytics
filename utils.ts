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
 * 导出排行榜数据为 CSV 格式
 */
export const exportLeaderboardToCSV = (
    lines: any[],
    sessionType: string,
    penalties: any[] = [],
    trackName: string = '',
    sessionName: string = '',
    carModels: Record<number, string> = {}
) => {
    // 排序逻辑与 Leaderboard 组件保持一致
    const sortedLines = sessionType === 'R' 
        ? lines
        : [...lines].sort((a, b) => a.timing.bestLap - b.timing.bestLap);

    const isDisqualified = (carId: number): boolean => {
        return penalties.some(p => p.carId === carId && p.penalty === 'Disqualified');
    };

    const getDSQReason = (carId: number): string | null => {
        const dsqPenalty = penalties.find(p => p.carId === carId && p.penalty === 'Disqualified');
        return dsqPenalty?.reason || null;
    };

    const leader = sortedLines[0];
    const referenceTime =
        sessionType === 'R'
            ? leader?.timing.totalTime ?? 0
            : leader?.timing.bestLap ?? 0;

    // CSV 表头
    const headers = [
        '排名',
        '车号',
        '主车手',
        '其他车手',
        '车型',
        sessionType === 'R' ? '完赛时间' : '最快圈',
        '差距',
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
        const gap = isDSQ ? '-' : formatGap(timeValue, referenceTime);
        const timeStr = formatTime(timeValue);
        const rank = isDSQ ? 'DSQ' : (index + 1).toString();
        const status = isDSQ ? '取消资格' : (index === 0 ? '冠军' : '');

        return [
            rank,
            line.car.raceNumber.toString(),
            driverName,
            otherDrivers || '-',
            carName,
            timeStr,
            gap,
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
    
    // 生成文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const sessionTypeName = sessionType === 'R' ? '正赛' : sessionType === 'Q' ? '排位' : '练习';
    link.download = `排行榜_${trackName || '未知赛道'}_${sessionTypeName}_${timestamp}.csv`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
