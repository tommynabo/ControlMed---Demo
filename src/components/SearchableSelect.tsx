import React, { useState, useRef, useEffect } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';

interface SearchableSelectOption {
    id: string;
    label: string;
    value: string;
    price?: number;
}

interface SearchableSelectProps {
    options: SearchableSelectOption[];
    placeholder?: string;
    value: string;
    onChange: (value: string, option?: SearchableSelectOption) => void;
    onSearch?: (query: string) => void;
    loading?: boolean;
    className?: string;
    showPrice?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
    options,
    placeholder = '-- Seleccionar --',
    value,
    onChange,
    onSearch,
    loading = false,
    className = '',
    showPrice = true
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredOptions, setFilteredOptions] = useState<SearchableSelectOption[]>(options);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const onSearchRef = useRef(onSearch);
    onSearchRef.current = onSearch;

    // Get selected option label
    const selectedOption = options.find(o => o.value === value);
    const displayLabel = selectedOption?.label || placeholder;

    // Filter options based on search query
    useEffect(() => {
        if (searchQuery.trim() === '') {
            setFilteredOptions(options);
        } else {
            const query = searchQuery.toLowerCase();
            const filtered = options.filter(opt =>
                opt.label.toLowerCase().includes(query) ||
                opt.value.toLowerCase().includes(query)
            );
            setFilteredOptions(filtered);
        }
    }, [searchQuery, options]);

    // Handle search callback - use ref to prevent infinite re-render loop
    // when parent re-renders and creates a new onSearch function reference
    useEffect(() => {
        if (onSearchRef.current && isOpen) {
            onSearchRef.current(searchQuery);
        }
    }, [searchQuery, isOpen]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Focus input when dropdown opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const handleSelect = (option: SearchableSelectOption) => {
        onChange(option.value, option);
        setIsOpen(false);
        setSearchQuery('');
    };

    return (
        <div ref={containerRef} className={`relative w-full ${className}`}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-white border-2 border-slate-300 text-slate-900 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer flex items-center justify-between text-left hover:border-slate-400 transition-colors"
            >
                <span className="truncate">{displayLabel}</span>
                <ChevronDown size={16} className={`transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-slate-300 rounded-lg shadow-xl z-50 max-h-[300px] flex flex-col">
                    {/* Search Input */}
                    <div className="border-b border-slate-200 p-2 flex-shrink-0">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Buscar..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-8 pr-3 py-2 text-xs font-semibold outline-none rounded border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-slate-900"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Options List */}
                    <div className="overflow-y-auto flex-1">
                        {loading ? (
                            <div className="p-3 text-center text-slate-500 text-xs">
                                ⏳ Cargando...
                            </div>
                        ) : filteredOptions.length === 0 ? (
                            <div className="p-3 text-center text-slate-400 text-xs">
                                No hay resultados
                            </div>
                        ) : (
                            filteredOptions.map((option) => (
                                <button
                                    key={option.id}
                                    onClick={() => handleSelect(option)}
                                    className="w-full text-left px-3 py-2 text-xs font-bold text-slate-900 hover:bg-blue-50 transition-colors flex justify-between items-center border-b border-slate-100 last:border-0"
                                >
                                    <span>{option.label}</span>
                                    {showPrice && option.price && (
                                        <span className="text-slate-500 text-[10px] font-semibold ml-2">
                                            {option.price}€
                                        </span>
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
