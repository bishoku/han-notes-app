import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, ArrowRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DateRangePickerProps {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  onChange: (startDate: string, endDate: string) => void;
}

const MONTH_NAMES_TR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAYS_TR = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const WEEKDAYS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onChange,
}) => {
  const { t, i18n } = useTranslation();
  const isEnglish = i18n.language === 'en';
  const monthNames = isEnglish ? MONTH_NAMES_EN : MONTH_NAMES_TR;
  const weekdays = isEnglish ? WEEKDAYS_EN : WEEKDAYS_TR;

  const [isOpen, setIsOpen] = useState(false);

  // Active view date for calendar navigation
  const initialDate = startDate ? new Date(startDate) : new Date();
  const [viewDate, setViewDate] = useState<Date>(isNaN(initialDate.getTime()) ? new Date() : initialDate);

  // Selection states
  const [tempStart, setTempStart] = useState<string>(startDate);
  const [tempEnd, setTempEnd] = useState<string>(endDate);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [isSelectingEnd, setIsSelectingEnd] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Sync state when props change
  useEffect(() => {
    setTempStart(startDate);
    setTempEnd(endDate);
  }, [startDate, endDate]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.preventDefault();
    setViewDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.preventDefault();
    setViewDate(new Date(year, month + 1, 1));
  };

  // Helper to format Date to YYYY-MM-DD
  const formatDateStr = (d: Date): string => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Format date for display (e.g. 02 Tem 2026)
  const formatDisplay = (dateStr: string): string => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const d = parseInt(parts[2], 10);
    const m = parseInt(parts[1], 10) - 1;
    const y = parts[0];
    return `${d} ${monthNames[m]} ${y}`;
  };

  // Generate calendar days
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  // Monday-based day of week (0: Pzt, 6: Paz)
  let startDayOfWeek = firstDayOfMonth.getDay() - 1;
  if (startDayOfWeek === -1) startDayOfWeek = 6;

  const daysInMonth = lastDayOfMonth.getDate();

  const handleDayClick = (e: React.MouseEvent, dayNum: number) => {
    e.preventDefault();
    const clickedDate = new Date(year, month, dayNum);
    const dateStr = formatDateStr(clickedDate);

    if (!tempStart || (tempStart && tempEnd) || !isSelectingEnd) {
      // First click: set start date
      setTempStart(dateStr);
      setTempEnd('');
      setIsSelectingEnd(true);
    } else {
      // Second click: set end date
      if (dateStr < tempStart) {
        // If clicked date is before start, make it new start
        setTempStart(dateStr);
        setTempEnd('');
        setIsSelectingEnd(true);
      } else {
        setTempEnd(dateStr);
        setIsSelectingEnd(false);
        onChange(tempStart, dateStr);
        setIsOpen(false);
      }
    }
  };

  const handlePreset = (e: React.MouseEvent, daysCount: number) => {
    e.preventDefault();
    const today = new Date();
    const startStr = formatDateStr(today);
    const endDateObj = new Date(today);
    endDateObj.setDate(today.getDate() + (daysCount - 1));
    const endStr = formatDateStr(endDateObj);

    setTempStart(startStr);
    setTempEnd(endStr);
    setIsSelectingEnd(false);
    onChange(startStr, endStr);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    setTempStart('');
    setTempEnd('');
    setIsSelectingEnd(false);
    onChange('', '');
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl hover:border-mac-accent/50 focus:outline-none focus:ring-2 focus:ring-mac-accent/40 text-gray-800 dark:text-gray-200 transition-all text-xs"
      >
        <div className="flex items-center gap-2 truncate">
          <CalendarIcon size={14} className="text-mac-accent shrink-0" />
          {tempStart ? (
            <div className="flex items-center gap-1.5 font-mono font-medium truncate">
              <span>{formatDisplay(tempStart)}</span>
              <ArrowRight size={12} className="text-gray-400 shrink-0" />
              <span>{tempEnd ? formatDisplay(tempEnd) : t('selectEndDate')}</span>
            </div>
          ) : (
            <span className="text-gray-400">{t('selectDateRange')}</span>
          )}
        </div>
        {(tempStart || tempEnd) && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              handleClear(e);
            }}
            className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            title={t('clearDates')}
          >
            <X size={12} />
          </span>
        )}
      </button>

      {/* Popover Calendar Window */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 z-50 w-72 p-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95">
          {/* Header Month Nav */}
          <div className="flex items-center justify-between mb-3 px-1">
            <button
              onClick={handlePrevMonth}
              className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
              {monthNames[month]} {year}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Presets Bar */}
          <div className="flex items-center justify-between gap-1 mb-2.5 pb-2 border-b border-gray-100 dark:border-zinc-800 text-[10px]">
            <button
              onClick={(e) => handlePreset(e, 1)}
              className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-zinc-800 hover:bg-mac-accent/10 hover:text-mac-accent text-gray-600 dark:text-gray-300 font-medium transition-colors"
            >
              {t('today')}
            </button>
            <button
              onClick={(e) => handlePreset(e, 7)}
              className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-zinc-800 hover:bg-mac-accent/10 hover:text-mac-accent text-gray-600 dark:text-gray-300 font-medium transition-colors"
            >
              1 {t('week')}
            </button>
            <button
              onClick={(e) => handlePreset(e, 14)}
              className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-zinc-800 hover:bg-mac-accent/10 hover:text-mac-accent text-gray-600 dark:text-gray-300 font-medium transition-colors"
            >
              2 {t('week')}
            </button>
            <button
              onClick={(e) => handlePreset(e, 30)}
              className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-zinc-800 hover:bg-mac-accent/10 hover:text-mac-accent text-gray-600 dark:text-gray-300 font-medium transition-colors"
            >
              1 {t('month')}
            </button>
          </div>

          {/* Weekday Labels */}
          <div className="grid grid-cols-7 text-center mb-1">
            {weekdays.map((wd) => (
              <span key={wd} className="text-[10px] font-semibold text-gray-400 py-1">
                {wd}
              </span>
            ))}
          </div>

          {/* Grid of Days */}
          <div className="grid grid-cols-7 gap-y-1 text-center">
            {/* Empty slots before first day */}
            {Array.from({ length: startDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}

            {/* Days of month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateObj = new Date(year, month, dayNum);
              const dateStr = formatDateStr(dateObj);

              const isStart = tempStart === dateStr;
              const isEnd = tempEnd === dateStr;

              // Check if inside selected/hovered range
              const currentEffectiveEnd = tempEnd || (isSelectingEnd ? hoverDate : null);
              const inRange =
                tempStart &&
                currentEffectiveEnd &&
                dateStr >= tempStart &&
                dateStr <= currentEffectiveEnd;

              return (
                <button
                  key={dayNum}
                  onClick={(e) => handleDayClick(e, dayNum)}
                  onMouseEnter={() => isSelectingEnd && setHoverDate(dateStr)}
                  className={cn(
                    "h-7 text-xs rounded-lg flex items-center justify-center transition-all relative font-mono",
                    inRange && !isStart && !isEnd && "bg-mac-accent/15 text-mac-accent font-semibold rounded-none",
                    isStart && "bg-mac-accent text-white font-bold shadow-sm rounded-l-lg",
                    isEnd && "bg-mac-accent text-white font-bold shadow-sm rounded-r-lg",
                    !isStart && !isEnd && !inRange && "hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-800 dark:text-gray-200"
                  )}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-gray-100 dark:border-zinc-800 text-xs">
            <button
              onClick={handleClear}
              className="text-gray-400 hover:text-red-500 transition-colors text-[11px]"
            >
              {t('clearDates')}
            </button>

            <button
              onClick={() => {
                if (tempStart && tempEnd) {
                  onChange(tempStart, tempEnd);
                } else if (tempStart) {
                  onChange(tempStart, tempStart);
                }
                setIsOpen(false);
              }}
              className="flex items-center gap-1 px-3 py-1 bg-mac-accent text-white rounded-lg font-medium hover:bg-blue-600 transition-colors shadow-2xs text-xs"
            >
              <Check size={12} /> {t('ok')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
