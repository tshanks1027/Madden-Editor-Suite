import { useState, useEffect, useMemo } from 'react';
import {
  ROSTER_FIELD_DEFINITIONS,
  RosterField,
  getFieldsByPosition,
  getDefaultVisibleFields
} from '@shared/types/roster-fields';

export interface PositionFieldsConfig {
  availableFields: RosterField[];
  visibleFields: RosterField[];
  pinnedFields: RosterField[];
  highPriorityFields: RosterField[];
}

export function usePositionFields(selectedPosition?: string, showAllFields = false) {
  const [fieldConfig, setFieldConfig] = useState<PositionFieldsConfig>({
    availableFields: [],
    visibleFields: [],
    pinnedFields: [],
    highPriorityFields: []
  });

  // Calculate field configuration based on position
  const config = useMemo((): PositionFieldsConfig => {
    let availableFields: RosterField[];

    if (showAllFields) {
      // Show all 131+ fields
      availableFields = Object.values(ROSTER_FIELD_DEFINITIONS);
    } else if (selectedPosition) {
      // Show position-specific fields + general fields
      availableFields = getFieldsByPosition(selectedPosition);
    } else {
      // Show default visible fields only
      availableFields = getDefaultVisibleFields();
    }

    // Separate different types of fields
    const visibleFields = availableFields.filter(field =>
      field.defaultVisible || showAllFields ||
      (selectedPosition && field.positions?.includes(selectedPosition))
    );

    const pinnedFields = availableFields.filter(field => field.pinned);

    const highPriorityFields = availableFields.filter(field =>
      field.priority === 'high'
    );

    return {
      availableFields,
      visibleFields,
      pinnedFields,
      highPriorityFields
    };
  }, [selectedPosition, showAllFields]);

  useEffect(() => {
    setFieldConfig(config);
  }, [config]);

  // Helper functions
  const getFieldsByCategory = (category: string): RosterField[] => {
    return fieldConfig.availableFields.filter(field => field.category === category);
  };

  const getFieldByKey = (key: string): RosterField | undefined => {
    return fieldConfig.availableFields.find(field => field.key === key);
  };

  const isFieldVisible = (fieldKey: string): boolean => {
    return fieldConfig.visibleFields.some(field => field.key === fieldKey);
  };

  const isFieldEditable = (fieldKey: string): boolean => {
    const field = getFieldByKey(fieldKey);
    return field?.editable ?? false;
  };

  const getFieldCategories = (): string[] => {
    const categories = new Set(fieldConfig.availableFields.map(field => field.category));
    return Array.from(categories);
  };

  // Position-specific field recommendations
  const getRecommendedFields = (): RosterField[] => {
    if (!selectedPosition) return fieldConfig.highPriorityFields;

    const positionFieldMap: { [key: string]: string[] } = {
      'QB': ['PTHP', 'PTHA', 'PTAD', 'PTAM', 'PTAS', 'PAWR', 'PSPD', 'PACC'],
      'HB': ['PSPD', 'PACC', 'PAGI', 'PCAR', 'PCTH', 'PSTR', 'PSTA'],
      'WR': ['PSPD', 'PACC', 'PAGI', 'PCTH', 'PAWR', 'PJMP'],
      'TE': ['PCTH', 'PLBK', 'PRBK', 'PSTR', 'PHGT'],
      'LT': ['PLBK', 'PRBK', 'PSTR', 'PAWR', 'PHGT', 'PWGT'],
      'LG': ['PLBK', 'PRBK', 'PSTR', 'PAWR'],
      'C': ['PLBK', 'PRBK', 'PSTR', 'PAWR'],
      'RG': ['PLBK', 'PRBK', 'PSTR', 'PAWR'],
      'RT': ['PLBK', 'PRBK', 'PSTR', 'PAWR', 'PHGT', 'PWGT'],
      'DT': ['PSTR', 'PTAK', 'PAWR', 'PWGT'],
      'LEDG': ['PSTR', 'PTAK', 'PAWR', 'PSPD'],
      'REDG': ['PSTR', 'PTAK', 'PAWR', 'PSPD'],
      'SAM': ['PTAK', 'PAWR', 'PSPD', 'PSTR'],
      'Mike': ['PTAK', 'PAWR', 'PSPD', 'PSTR'],
      'WILL': ['PTAK', 'PAWR', 'PSPD', 'PAGI'],
      'CB': ['PSPD', 'PACC', 'PAGI', 'PAWR', 'PJMP'],
      'FS': ['PSPD', 'PAWR', 'PTAK', 'PJMP'],
      'SS': ['PSPD', 'PAWR', 'PTAK', 'PSTR'],
      'K': ['PAWR'],
      'P': ['PAWR'],
      'LS': ['PAWR']
    };

    const recommendedKeys = positionFieldMap[selectedPosition] || [];
    return fieldConfig.availableFields.filter(field =>
      recommendedKeys.includes(field.key) || field.priority === 'high'
    );
  };

  return {
    fieldConfig,
    getFieldsByCategory,
    getFieldByKey,
    isFieldVisible,
    isFieldEditable,
    getFieldCategories,
    getRecommendedFields,

    // Direct access to computed values
    availableFields: fieldConfig.availableFields,
    visibleFields: fieldConfig.visibleFields,
    pinnedFields: fieldConfig.pinnedFields,
    highPriorityFields: fieldConfig.highPriorityFields
  };
}