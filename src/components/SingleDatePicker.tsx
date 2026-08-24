import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SingleDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
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

export const SingleDatePicker: React.FC<SingleDatePickerProps> = ({
  value,
  onChange,
  placeholder,
}) => {
  const { t, i18n } = useTranslation();
  const isEnglish = i18n.language === 'en';
  const monthNames = isEnglish ? MONTH_NAMES_EN : MONTH_NAMES_TR;
  const weekdays = isEnglish ? WEEKDAYS_EN : WEEKDAYS_TR;

  const [isOpen, setIsOpen] = useState(false);

  const initialDate = value ? new Date(value) : new Date();
  const [viewDate, setViewDate] = useState<Date>(isNaN(initialDate.getTime()) ? new Date() : initialDate);

  const containerRef = useRef<HTMLDivElement>(null);

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
    e.stopPropagation();
    setViewDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setViewDate(new Date(year, month + 1, 1));
  };

  const formatDateStr = (d: Date): string => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const formatDisplay = (dateStr: string): string => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const d = parseInt(parts[2], 10);
    const m = parseInt(parts[1], 10) - 1;
    const y = parts[0];
    return `${d} ${monthNames[m]} ${y}`;
  };

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  let startDayOfWeek = firstDayOfMonth.getDay() - 1;
  if (startDayOfWeek === -1) startDayOfWeek = 6;

  const daysInMonth = lastDayOfMonth.getDate();

  const handleDayClick = (e: React.MouseEvent, dayNum: number) => {
    e.preventDefault();
    e.stopPropagation();
    const clickedDate = new Date(year, month, dayNum);
    const dateStr = formatDateStr(clickedDate);
    onChange(dateStr);
    setIsOpen(false);
  };

  const handleToday = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const todayStr = formatDateStr(new Date());
    onChange(todayStr);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange('');
    setIsOpen(false);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl hover:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/40 text-gray-800 dark:text-gray-200 transition-all text-xs"
      >
        <div className="flex items-center gap-2 truncate">
          <CalendarIcon size={14} className="text-purple-600 dark:text-purple-400 shrink-0" />
          {value ? (
            <span className="font-mono font-medium truncate">{formatDisplay(value)}</span>
          ) : (
            <span className="text-gray-400">{placeholder || t('selectDate')}</span>
          )}
        </div>
        {value && (
          <span
            onClick={handleClear}
            className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            title={t('clearDates')}
          >
            <X size={12} />
          </span>
        )}
      </button>

      {/* Compact Popover Calendar Window */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 z-50 w-64 p-2.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-xl animate-in fade-in zoom-in-95">
          {/* Header Month Nav */}
          <div className="flex items-center justify-between mb-2 px-1">
            <button
              onClick={handlePrevMonth}
              className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
              {monthNames[month]} {year}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          {/* Weekday Labels */}
          <div className="grid grid-cols-7 text-center mb-1">
            {weekdays.map((wd) => (
              <span key={wd} className="text-[10px] font-semibold text-gray-400 py-0.5">
                {wd}
              </span>
            ))}
          </div>

          {/* Grid of Days */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {Array.from({ length: startDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateObj = new Date(year, month, dayNum);
              const dateStr = formatDateStr(dateObj);
              const isSelected = value === dateStr;

              return (
                <button
                  key={dayNum}
                  onClick={(e) => handleDayClick(e, dayNum)}
                  className={cn(
                    "h-6 text-xs rounded-lg flex items-center justify-center transition-all font-mono",
                    isSelected 
                      ? "bg-purple-600 text-white font-bold shadow-xs" 
                      : "hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-800 dark:text-gray-200"
                  )}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>

          {/* Footer Quick Today */}
          <div className="flex items-center justify-between pt-2 mt-2 border-t border-gray-100 dark:border-zinc-800 text-xs">
            <button
              onClick={handleClear}
              className="text-gray-400 hover:text-red-500 transition-colors text-[11px]"
            >
              {t('clearDates')}
            </button>

            <button
              onClick={handleToday}
              className="text-purple-600 dark:text-purple-400 hover:underline font-medium text-[11px]"
            >
              {t('today')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
