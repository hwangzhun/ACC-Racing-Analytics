import React, { useMemo, useState } from 'react';
import {
    LeaderboardLine,
    CAR_MODELS,
    Penalty,
    getCarClassByModelId,
    CarPerformanceClass,
} from '../types';
import {
    formatTime,
    formatGap,
    exportLeaderboardToCSV,
    carClassBadgeClass,
    sumJsonTimePenaltyMs,
    formatPenaltyDelta,
    getCarSessionPenaltyBadgeLabels,
    carHasNonDsqJsonPenalties,
    sortLeaderboardLinesForDisplay,
    rerankLeaderboardByRaceRules,
    detectLeaderboardAnomalies,
    hasAnyManualPenaltyMs,
    getRaceAdjustedFinishMs,
} from '../utils';
import { Crown, Timer, Download, AlertTriangle, ArrowUpDown, X } from 'lucide-react';

type LeaderboardClassFilter = 'all' | CarPerformanceClass;

const CLASS_FILTER_OPTIONS: { value: LeaderboardClassFilter; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'GT2', label: 'GT2' },
    { value: 'GT3', label: 'GT3' },
    { value: 'GT4', label: 'GT4' },
];

interface LeaderboardProps {
    lines: LeaderboardLine[];
    sessionType: string;
    onSelectDriver: (carId: number) => void;
    selectedCarId: number | null;
    penalties?: Penalty[];
    manualPenaltyMsByCarId?: Record<number, number>;
    trackName?: string;
    sessionName?: string;
    classFilter: LeaderboardClassFilter;
    onClassFilterChange: (filter: LeaderboardClassFilter) => void;
    useRerankedLeaderboard: boolean;
    onUseRerankedLeaderboardChange: (enabled: boolean) => void;
    onExportJson?: () => void;
}

const Leaderboard: React.FC<LeaderboardProps> = ({
    lines,
    sessionType,
    onSelectDriver,
    selectedCarId,
    penalties = [],
    manualPenaltyMsByCarId = {},
    trackName = '',
    sessionName = '',
    classFilter,
    onClassFilterChange,
    useRerankedLeaderboard,
    onUseRerankedLeaderboardChange,
    onExportJson,
}) => {
    const [showRerankModal, setShowRerankModal] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const sortedLines = useRerankedLeaderboard
        ? rerankLeaderboardByRaceRules(lines, sessionType, penalties, manualPenaltyMsByCarId)
        : sortLeaderboardLinesForDisplay(lines, sessionType, penalties, manualPenaltyMsByCarId);
    const rawSortedLines = sortLeaderboardLinesForDisplay(lines, sessionType, penalties, manualPenaltyMsByCarId);
    const visibleLines =
        classFilter === 'all'
            ? sortedLines
            : sortedLines.filter((l) => getCarClassByModelId(l.car.carModel) === classFilter);
    const anomalies = detectLeaderboardAnomalies(sortedLines, sessionType, penalties, manualPenaltyMsByCarId);
    const hasAnomaly = anomalies.length > 0;
    const anomalyRaceNumbers = Array.from(
        new Set(
            anomalies.flatMap((a) => [a.frontRaceNumber, a.behindRaceNumber]).filter((n) => Number.isFinite(n))
        )
    ).sort((a, b) => a - b);
    const rerankChanges = useMemo(() => {
        if (sessionType !== 'R') return [];
        const beforeMap = new Map<number, number>();
        rawSortedLines.forEach((line, idx) => {
            beforeMap.set(line.car.carId, idx + 1);
        });
        const afterLines = rerankLeaderboardByRaceRules(lines, sessionType, penalties, manualPenaltyMsByCarId);
        const changes = afterLines
            .map((line, idx) => {
                const oldRank = beforeMap.get(line.car.carId);
                const newRank = idx + 1;
                if (!oldRank || oldRank === newRank) return null;
                const driverName =
                    `${line.currentDriver.firstName} ${line.currentDriver.lastName}`.trim() ||
                    line.currentDriver.shortName;
                return {
                    carId: line.car.carId,
                    raceNumber: line.car.raceNumber,
                    driverName,
                    oldRank,
                    newRank,
                    delta: oldRank - newRank,
                };
            })
            .filter((x): x is NonNullable<typeof x> => x != null)
            .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
        return changes;
    }, [lines, sessionType, penalties, manualPenaltyMsByCarId, rawSortedLines]);

    const handleRerankToggle = () => {
        const next = !useRerankedLeaderboard;
        onUseRerankedLeaderboardChange(next);
        if (next && sessionType === 'R') {
            setShowRerankModal(true);
        }
    };
    const handleExportCsv = () => {
        exportLeaderboardToCSV(
            lines,
            sessionType,
            penalties,
            trackName,
            sessionName,
            CAR_MODELS,
            manualPenaltyMsByCarId,
            sortedLines
        );
        setShowExportModal(false);
    };
    const handleExportJson = () => {
        onExportJson?.();
        setShowExportModal(false);
    };

    const isDisqualified = (carId: number): boolean =>
        penalties.some((p) => p.carId === carId && p.penalty === 'Disqualified');

    const isRace = sessionType === 'R';
    const anyManual = hasAnyManualPenaltyMs(manualPenaltyMsByCarId);
    const leaderLine =
        visibleLines.find((l) => !isDisqualified(l.car.carId)) ?? visibleLines[0];
    const referenceOfficialRace = leaderLine?.timing.totalTime ?? 0;
    const referenceBest = leaderLine?.timing.bestLap ?? 0;
    const referenceAdjusted =
        isRace && anyManual && leaderLine && !isDisqualified(leaderLine.car.carId)
            ? getRaceAdjustedFinishMs(leaderLine, penalties, manualPenaltyMsByCarId)
            : null;
    return (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-2xl">
            <div className="p-4 bg-slate-800/50 border-b border-slate-700 flex justify-between items-center gap-3 flex-wrap">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 min-w-0">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2 shrink-0">
                        <Timer className="w-5 h-5 text-red-500" />
                        排行榜
                    </h3>
                    <div
                        className="flex flex-wrap items-center gap-1 p-0.5 rounded-lg bg-slate-900 border border-slate-700"
                        role="group"
                        aria-label="按组别筛选"
                    >
                        {CLASS_FILTER_OPTIONS.map(({ value, label }) => {
                            const active = classFilter === value;
                            return (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => onClassFilterChange(value)}
                                    className={`px-2.5 py-1 text-xs font-mono font-semibold rounded-md transition-colors ${
                                        active
                                            ? 'bg-slate-700 text-white shadow-sm'
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {sessionType === 'R' ? (
                        <button
                            type="button"
                            onClick={handleRerankToggle}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-colors ${
                                useRerankedLeaderboard
                                    ? 'bg-emerald-900/40 border-emerald-600/70 text-emerald-300'
                                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white'
                            }`}
                            title="按圈数优先规则重排"
                        >
                            <ArrowUpDown className="w-3.5 h-3.5" />
                            {useRerankedLeaderboard ? '已重排' : '重新排名'}
                        </button>
                    ) : null}
                    <span className="text-xs text-slate-500 font-mono bg-slate-900 px-2 py-1 rounded whitespace-nowrap">
                        {classFilter === 'all'
                            ? `${lines.length} 位车手`
                            : `${visibleLines.length} / ${lines.length} 位车手`}
                    </span>
                    <button
                        type="button"
                        onClick={() => setShowExportModal(true)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 transition-colors text-xs font-mono"
                        title="导出"
                    >
                        <Download className="w-4 h-4" />
                        导出
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                {sessionType === 'R' && hasAnomaly ? (
                    <div
                        className="mx-3 mt-3 mb-1 px-3 py-2 rounded-lg border text-xs font-mono flex items-start gap-2 bg-amber-950/30 border-amber-700/60 text-amber-200"
                    >
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div className="leading-relaxed">
                            检测到 {anomalies.length} 处潜在排名异常，分别为{' '}
                            {anomalyRaceNumbers.length > 0
                                ? anomalyRaceNumbers.map((num) => `#${num}`).join('、')
                                : '相关车号'}
                            。可点击「重新排名」按“圈数优先、含罚时完赛时间次之”重排。
                        </div>
                    </div>
                ) : null}
                <table className="w-full min-w-[880px] xl:min-w-[1260px] text-left text-sm table-auto">
                    <thead>
                        <tr className="bg-slate-900 text-slate-400 font-mono text-xs uppercase tracking-wider">
                            <th className="p-3 text-center min-w-[4.5rem]">排名</th>
                            <th className="p-3 w-14 shrink-0">#</th>
                            <th className="p-3 min-w-[9rem]">车手</th>
                            <th className="hidden xl:table-cell p-3 w-24 text-center whitespace-nowrap">组别</th>
                            <th className="hidden xl:table-cell p-3 min-w-[10rem]">车型</th>
                            <th className="p-3 text-right whitespace-nowrap min-w-[6.5rem]">
                                {isRace ? '完赛时间' : '最快圈'}
                            </th>
                            <th className="p-3 text-right whitespace-nowrap min-w-[4.5rem]">差距</th>
                            <th className="p-3 text-right whitespace-nowrap min-w-[5.5rem]">罚时</th>
                            <th className="p-3 text-center whitespace-nowrap min-w-[6rem]">处罚</th>
                            {isRace ? (
                                <th className="p-3 text-right whitespace-nowrap min-w-[6.5rem]">含罚时完赛</th>
                            ) : null}
                            <th className="p-3 text-center whitespace-nowrap w-16">圈数</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                        {visibleLines.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={isRace ? 11 : 10}
                                    className="p-8 text-center text-slate-500 text-sm"
                                >
                                    {classFilter === 'all'
                                        ? '暂无车手数据'
                                        : `该会话无 ${classFilter} 车手`}
                                </td>
                            </tr>
                        ) : null}
                        {visibleLines.map((line, index) => {
                            const isSelected = selectedCarId === line.car.carId;
                            const dsq = isDisqualified(line.car.carId);
                            const isWinner = index === 0 && !dsq;
                            const driverName =
                                `${line.currentDriver.firstName} ${line.currentDriver.lastName}`.trim() ||
                                line.currentDriver.shortName;
                            const carName = CAR_MODELS[line.car.carModel] || `车型 ${line.car.carModel}`;
                            const carClass = getCarClassByModelId(line.car.carModel);
                            const classLabel = carClass ?? '—';
                            const timeValue = isRace ? line.timing.totalTime : line.timing.bestLap;
                            let gapStr = '';
                            if (!dsq) {
                                if (isRace && anyManual) {
                                    const curAdj = getRaceAdjustedFinishMs(line, penalties, manualPenaltyMsByCarId);
                                    if (curAdj != null && referenceAdjusted != null) {
                                        gapStr = formatGap(curAdj, referenceAdjusted);
                                    } else {
                                        gapStr = formatGap(timeValue, referenceOfficialRace);
                                    }
                                } else {
                                    gapStr = formatGap(timeValue, isRace ? referenceOfficialRace : referenceBest);
                                }
                            }
                            const cid = line.car.carId;
                            const jsonMs = sumJsonTimePenaltyMs(cid, penalties);
                            const manualMs = Math.max(0, manualPenaltyMsByCarId[cid] ?? 0);
                            const totalPenaltyMs = jsonMs + manualMs;
                            const totalTimeRaw = line.timing.totalTime;
                            const showWithPenalty =
                                isRace &&
                                totalTimeRaw &&
                                totalTimeRaw !== 2147483647;
                            const penaltyBadges = getCarSessionPenaltyBadgeLabels(cid, penalties);
                            const hasManualDsq = penalties.some(
                                (p) => p.carId === cid && p.penalty === 'Disqualified' && p.reason === 'Manual DSQ'
                            );
                            const penaltyDisplayLabels = hasManualDsq ? [...penaltyBadges, 'DSQ'] : penaltyBadges;
                            const highlightNumber = carHasNonDsqJsonPenalties(cid, penalties);

                            return (
                                <tr
                                    key={line.car.carId}
                                    onClick={() => onSelectDriver(line.car.carId)}
                                    className={`
                                        cursor-pointer transition-colors hover:bg-slate-700/50
                                        ${isSelected ? 'bg-slate-700 border-l-4 border-red-500' : 'border-l-4 border-transparent'}
                                        ${dsq ? 'opacity-70' : ''}
                                    `}
                                >
                                    <td className="p-3 text-center font-bold text-slate-300 align-middle min-w-[4.5rem]">
                                        {dsq ? (
                                            <span className="text-red-400 text-xs font-mono">DSQ</span>
                                        ) : isWinner ? (
                                            <Crown className="w-4 h-4 text-yellow-500 mx-auto" />
                                        ) : (
                                            index + 1
                                        )}
                                    </td>
                                    <td className="p-3 font-mono text-slate-400">
                                        <div
                                            className={`w-8 h-8 rounded flex items-center justify-center border text-xs font-bold transition-colors ${
                                                highlightNumber
                                                    ? 'bg-yellow-950/50 border-yellow-500/80 text-yellow-200 shadow-[0_0_0_1px_rgba(234,179,8,0.25)]'
                                                    : 'bg-slate-900 border-slate-700 text-white'
                                            }`}
                                        >
                                            {line.car.raceNumber}
                                        </div>
                                    </td>
                                    <td className="p-3">
                                        <div className="font-bold text-white truncate" title={driverName}>
                                            {driverName}
                                        </div>
                                        <div className="mt-1 xl:hidden flex flex-wrap items-center gap-1.5">
                                            <span
                                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${carClassBadgeClass(carClass)}`}
                                            >
                                                {classLabel}
                                            </span>
                                            <span className="text-xs text-slate-500 truncate max-w-[10rem]">{carName}</span>
                                        </div>
                                    </td>
                                    <td className="hidden xl:table-cell p-3 text-center">
                                        <span
                                            className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border whitespace-nowrap ${carClassBadgeClass(carClass)}`}
                                        >
                                            {classLabel}
                                        </span>
                                    </td>
                                    <td className="hidden xl:table-cell p-3 text-slate-400 text-xs whitespace-normal break-words max-w-[14rem]">
                                        {carName}
                                    </td>
                                    <td
                                        className={`p-3 text-right font-mono font-bold ${
                                            isWinner ? 'text-purple-400' : 'text-slate-200'
                                        }`}
                                    >
                                        {dsq ? '—' : formatTime(timeValue)}
                                    </td>
                                    <td className="p-3 text-right font-mono text-xs text-slate-400">
                                        {dsq ? '—' : gapStr}
                                    </td>
                                    <td
                                        className={`p-3 text-right font-mono text-xs ${
                                            totalPenaltyMs > 0 ? 'text-amber-300/90' : 'text-slate-500'
                                        }`}
                                    >
                                        {formatPenaltyDelta(totalPenaltyMs)}
                                    </td>
                                    <td className="p-3 text-center font-mono text-[11px] text-yellow-400/90">
                                        {penaltyDisplayLabels.length > 0 ? (
                                            <span className="inline-block leading-snug break-words max-w-[8rem]" title={penaltyDisplayLabels.join(' ')}>
                                                {penaltyDisplayLabels.join(' ')}
                                            </span>
                                        ) : (
                                            <span className="text-slate-600">—</span>
                                        )}
                                    </td>
                                    {isRace ? (
                                        <td className="p-3 text-right font-mono text-xs text-slate-300">
                                            {dsq || !showWithPenalty ? '—' : formatTime(totalTimeRaw + totalPenaltyMs)}
                                        </td>
                                    ) : null}
                                    <td className="p-3 text-center text-slate-500 font-mono">
                                        {line.timing.lapCount}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                <p className="px-3 py-2 text-[10px] text-slate-500 border-t border-slate-700/50 bg-slate-900/30 space-y-1">
                    {classFilter !== 'all' ? (
                        <span className="block text-slate-400">
                            当前为组内视图：排名与差距相对本组首位；CSV 导出仍为全会话完整榜单。
                        </span>
                    ) : null}
                    <span className="block">
                        {isRace && useRerankedLeaderboard
                            ? '当前为手动重排视图：名次与差距按“圈数优先 + 含罚时完赛时间”计算；「完赛时间」列仍为服务器原始成绩。'
                            : isRace && anyManual
                                ? '已输入手动罚时：默认视图下名次与差距仍以服务器原始顺序为准，可点击「重新排名」按圈数与含罚时重排。'
                                : '名次与差距以服务器原始成绩为准；罚时列为 JSON 时间罚与手动罚时之和。需要时可点击「重新排名」按圈数与含罚时重排。'}
                    </span>
                </p>
            </div>
            {showRerankModal ? (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-2xl bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                            <h4 className="text-sm font-bold text-white">重新排名已应用</h4>
                            <button
                                type="button"
                                onClick={() => setShowRerankModal(false)}
                                className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700"
                                aria-label="关闭"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="px-4 py-3 text-sm text-slate-300 space-y-2">
                            <p>已按“圈数优先、含罚时完赛时间次之”完成重排。</p>
                            {rerankChanges.length === 0 ? (
                                <p className="text-emerald-300">名次无变化，无需调整详情列表。</p>
                            ) : (
                                <>
                                    <p className="text-amber-300">修改详情列表（共 {rerankChanges.length} 项）：</p>
                                    <div className="max-h-72 overflow-auto rounded-lg border border-slate-700">
                                        <table className="w-full text-xs font-mono">
                                            <thead className="bg-slate-900 text-slate-400">
                                                <tr>
                                                    <th className="px-3 py-2 text-left">车号</th>
                                                    <th className="px-3 py-2 text-left">车手</th>
                                                    <th className="px-3 py-2 text-right">原名次</th>
                                                    <th className="px-3 py-2 text-right">新名次</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-700/60">
                                                {rerankChanges.map((item) => (
                                                    <tr key={item.carId} className="text-slate-200">
                                                        <td className="px-3 py-2">#{item.raceNumber}</td>
                                                        <td className="px-3 py-2">{item.driverName}</td>
                                                        <td className="px-3 py-2 text-right">{item.oldRank}</td>
                                                        <td className="px-3 py-2 text-right">{item.newRank}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="px-4 py-3 border-t border-slate-700 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setShowRerankModal(false)}
                                className="px-3 py-1.5 rounded-md bg-red-600/90 text-white text-xs font-semibold hover:bg-red-500"
                            >
                                知道了
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
            {showExportModal ? (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-sm bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                            <h4 className="text-sm font-bold text-white">选择导出格式</h4>
                            <button
                                type="button"
                                onClick={() => setShowExportModal(false)}
                                className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700"
                                aria-label="关闭"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="px-4 py-4 space-y-2">
                            <button
                                type="button"
                                onClick={handleExportCsv}
                                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 hover:text-white hover:border-slate-500 transition-colors text-sm font-mono"
                            >
                                导出 CSV
                            </button>
                            {onExportJson ? (
                                <button
                                    type="button"
                                    onClick={handleExportJson}
                                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 hover:text-white hover:border-slate-500 transition-colors text-sm font-mono"
                                >
                                    导出 JSON
                                </button>
                            ) : null}
                        </div>
                        <div className="px-4 py-3 border-t border-slate-700 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setShowExportModal(false)}
                                className="px-3 py-1.5 rounded-md bg-slate-700 text-white text-xs font-semibold hover:bg-slate-600"
                            >
                                取消
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export default Leaderboard;
