import React, { useState, useEffect, useRef } from 'react';
import carsData from '../cars.json';


const SearchableSelect = ({
  options,
  value,
  onChange,
  placeholder,
  disabled,
  loading,
  searchValue,
  onSearchChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState(options);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (searchValue) {
      const filtered = options.filter(option =>
        option.label.toLowerCase().includes(searchValue.toLowerCase()) ||
        (option.cyrillic_name && option.cyrillic_name.toLowerCase().includes(searchValue.toLowerCase()))
      );
      setFilteredOptions(filtered);
    } else {
      setFilteredOptions(options);
    }
  }, [options, searchValue]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {

    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleSelect = (option) => {
    console.log('Выбрана опция:', option);
    onChange(option);
    setIsOpen(false);
    if (onSearchChange) {
      onSearchChange('');
    }
  };

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="searchable-select" ref={dropdownRef} style={{ position: 'relative' }}>
      <div
        className={`select-input ${disabled ? 'disabled' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          padding: '0.75rem',
          border: '1px solid #ddd',
          borderRadius: '6px',
          backgroundColor: disabled ? '#f5f5f5' : 'white',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          minHeight: '48px'
        }}
      >
        <span style={{ color: selectedOption ? '#2c3e50' : '#95a5a6' }}>
          {loading ? 'Загрузка...' : (selectedOption ? selectedOption.label : placeholder)}
        </span>
        <span style={{ color: '#95a5a6' }}>
          {isOpen ? '▲' : '▼'}
        </span>
      </div>

      {isOpen && !disabled && (
        <div
          className="select-dropdown"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: 'white',
            border: '1px solid #ddd',
            borderTop: 'none',
            borderRadius: '0 0 6px 6px',
            maxHeight: '300px',
            overflowY: 'auto',
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }}
        >
          <div style={{
            padding: '0.75rem',
            borderBottom: '1px solid #eee',
            position: 'sticky',
            top: 0,
            backgroundColor: 'white',
            zIndex: 1
          }}>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Начните вводить название..."
              value={searchValue || ''}
              onChange={(e) => onSearchChange(e.target.value)}
              style={{
                width: '100%',
                padding: '0.6rem',
                border: '2px solid #ddd',
                borderRadius: '4px',
                fontSize: '0.9rem',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = '#3498db'}
              onBlur={(e) => e.target.style.borderColor = '#ddd'}
              onClick={(e) => e.stopPropagation()}
            />
            {searchValue && (
              <div style={{
                fontSize: '0.75rem',
                color: '#666',
                marginTop: '0.25rem'
              }}>
                Найдено: {filteredOptions.length}
              </div>
            )}
          </div>

          <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
            {filteredOptions.length === 0 ? (
              <div style={{
                padding: '2rem 1rem',
                textAlign: 'center',
                color: '#95a5a6'
              }}>
                <div>Ничего не найдено</div>
                <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  Попробуйте изменить запрос
                </div>
              </div>
            ) : (
              filteredOptions.map(option => (
                <div
                  key={option.value}
                  className="select-option"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSelect(option);
                  }}
                  style={{
                    padding: '0.75rem 1rem',
                    cursor: 'pointer',
                    borderBottom: '1px solid #f5f5f5',
                    transition: 'background-color 0.15s',
                    userSelect: 'none',
                    backgroundColor: 'white'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                >
                  <div style={{ fontWeight: '500', color: '#2c3e50' }}>{option.label}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const CarSelector = ({
  selectedBrand,
  selectedModel,
  onBrandChange,
  onModelChange,
  disabled = false
}) => {
  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);
  const [brandSearch, setBrandSearch] = useState('');
  const [modelSearch, setModelSearch] = useState('');


  useEffect(() => {
    loadBrands();
  }, []);


  useEffect(() => {
    if (selectedBrand) {
      loadModels(selectedBrand);
    } else {
      setModels([]);
      if (selectedModel) {
        onModelChange('');
      }
    }
  }, [selectedBrand]);

  const loadBrands = () => {
    console.log('Загружаем марки из локального файла cars.json...');


    const brandOptions = carsData.map(brand => ({
      value: brand.id,
      label: brand.name,
      name: brand.name,
      cyrillic_name: brand.cyrillic_name
    }));


    brandOptions.sort((a, b) => a.label.localeCompare(b.label));

    console.log('Загружено марок из локального файла:', brandOptions.length);
    setBrands(brandOptions);
  };

  const loadModels = (brandName) => {
    console.log('Загружаем модели для марки из локального файла:', brandName);


    const brand = carsData.find(b => b.name === brandName);

    if (!brand || !brand.models) {
      console.log('Марка не найдена или нет моделей');
      setModels([]);
      return;
    }


    const modelOptions = brand.models.map(model => ({
      value: model.id,
      label: model.name,
      name: model.name,
      cyrillic_name: model.cyrillic_name
    }));


    modelOptions.sort((a, b) => a.label.localeCompare(b.label));

    console.log('Загружено моделей из локального файла:', modelOptions.length);
    setModels(modelOptions);
  };

  const handleBrandChange = (brandOption) => {
    console.log('Выбрана марка:', brandOption);
    if (brandOption && brandOption.name) {
      onBrandChange(brandOption.name);

      if (selectedModel) {
        onModelChange('');
      }
    }
  };

  const handleModelChange = (modelOption) => {
    console.log('Выбрана модель:', modelOption);
    if (modelOption && modelOption.name) {
      onModelChange(modelOption.name);
    }
  };

  return (
    <div className="car-selector">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="form-group">
          <label style={{ fontWeight: '500', marginBottom: '0.5rem', display: 'block' }}>
            Марка автомобиля
          </label>
          <SearchableSelect
            options={brands}
            value={brands.find(b => b.name === selectedBrand)?.value || ''}
            onChange={handleBrandChange}
            placeholder="Выберите марку..."
            disabled={disabled}
            loading={false}
            searchValue={brandSearch}
            onSearchChange={setBrandSearch}
          />
        </div>

        <div className="form-group">
          <label style={{ fontWeight: '500', marginBottom: '0.5rem', display: 'block' }}>
            Модель автомобиля
          </label>
          <SearchableSelect
            options={models}
            value={models.find(m => m.name === selectedModel)?.value || ''}
            onChange={handleModelChange}
            placeholder={selectedBrand ? "Выберите модель..." : "Сначала выберите марку"}
            disabled={disabled || !selectedBrand}
            loading={false}
            searchValue={modelSearch}
            onSearchChange={setModelSearch}
          />
        </div>
      </div>
    </div>
  );
};

export default CarSelector;
