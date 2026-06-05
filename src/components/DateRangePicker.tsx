import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';

interface DateRangePickerProps {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD or empty
  onChange: (start: string, end: string) => void;
  placeholder?: string;
  required?: boolean;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onChange,
  placeholder = "Select Date(s)",
  required = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calendar view state
  const [currentDate, setCurrentDate] = useState(() => {
    if (startDate) return new Date(startDate + 'T00:00:00');
    return new Date();
  });

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  // Handle month navigation
  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Convert Date object to YYYY-MM-DD format in local timezone
  const formatDateString = (y: number, m: number, d: number): string => {
    const mm = String(m + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  };

  // Handle day selection (Range selection or Single selection)
  const handleDayClick = (day: number) => {
    const clickedDateStr = formatDateString(year, month, day);

    if (!startDate || (startDate && endDate)) {
      // First click: select start date, clear end date
      onChange(clickedDateStr, '');
    } else if (startDate && !endDate) {
      // Second click: select end date if it is after start date, otherwise swap
      if (new Date(clickedDateStr) < new Date(startDate)) {
        onChange(clickedDateStr, startDate);
      } else {
        onChange(startDate, clickedDateStr);
      }
    }
  };

  // Render month header name
  const monthName = currentDate.toLocaleString('default', { month: 'long' });

  // Check if a specific date list status (isSelected, isInRange, etc.)
  const isDateSelected = (d: number): boolean => {
    const dStr = formatDateString(year, month, d);
    return startDate === dStr || endDate === dStr;
  };

  const isDateInRange = (d: number): boolean => {
    if (!startDate || !endDate) return false;
    const dTime = new Date(formatDateString(year, month, d)).getTime();
    const startTime = new Date(startDate).getTime();
    const endTime = new Date(endDate).getTime();
    return dTime > startTime && dTime < endTime;
  };

  // Display value in input text bar
  const getDisplayValue = () => {
    if (!startDate) return '';
    if (startDate && !endDate) {
      const d = new Date(startDate + 'T00:00:00');
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    const s = new Date(startDate + 'T00:00:00');
    const e = new Date(endDate + 'T00:00:00');
    return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Hidden inputs to support system form validations */}
      <input type="hidden" required={required} value={startDate} name="startDate_hidden" />

      {/* Main trigger button styled as the previous raw input box */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full pl-14 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#e90b35] cursor-pointer relative flex items-center select-none"
      >
        <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        {getDisplayValue() ? (
          <span className="text-gray-900 font-medium">{getDisplayValue()}</span>
        ) : (
          <span className="text-gray-400">{placeholder}</span>
        )}
      </div>

      {isOpen && (
        <div className="absolute top-[calc(100%+8px)] left-0 z-50 bg-white p-5 rounded-2xl shadow-xl border border-gray-100 w-[320px] sm:w-[340px] animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex justify-between items-center mb-4">
            <button 
              type="button" 
              onClick={prevMonth}
              className="p-1 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="font-bold text-gray-800 text-sm hover:text-red-500 transition-colors">
              {monthName} {year}
            </span>
            <button 
              type="button" 
              onClick={nextMonth}
              className="p-1 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Days of week */}
          <div className="grid grid-cols-7 text-center text-xs font-bold text-gray-400 mb-2">
            <div>Su</div>
            <div>Mo</div>
            <div>Tu</div>
            <div>We</div>
            <div>Th</div>
            <div>Fr</div>
            <div>Sa</div>
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 text-center gap-y-1 text-sm">
            {/* Empty space pads */}
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}

            {/* Days list */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isSelected = isDateSelected(day);
              const isInRange = isDateInRange(day);

              return (
                <button
                  key={`day-${day}`}
                  type="button"
                  onClick={() => handleDayClick(day)}
                  className={`py-1.5 rounded-lg font-semibold transition-all text-xs flex items-center justify-center ${
                    isSelected
                      ? 'bg-[#e90b35] text-white'
                      : isInRange
                      ? 'bg-red-50 text-[#e90b35]'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => onChange('', '')}
              className="text-gray-400 hover:text-red-500 flex items-center gap-1 font-semibold"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Selection
            </button>
            <span className="text-[10px] text-gray-400 font-semibold italic">
              Click start & end dates
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
