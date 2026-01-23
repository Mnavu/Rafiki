"use strict";
exports.__esModule = true;
exports.themeColors = exports.roleColors = exports.palette = void 0;
exports.palette = {
    primary: '#0057FF',
    secondary: '#FF7A00',
    success: '#2ECC71',
    warning: '#F2C94C',
    danger: '#EB5757',
    background: '#F7F8FA',
    surface: '#FFFFFF',
    textPrimary: '#1F2A37',
    textSecondary: '#4B5563',
    disabled: '#D1D5DB',
    accent: '#7F56DA'
};
exports.roleColors = {
    student: '#2563EB',
    parent: '#C026D3',
    lecturer: '#0D9488',
    hod: '#F97316',
    finance: '#0F172A',
    records: '#BE123C',
    admin: '#7C3AED',
    superadmin: '#0B4EA2',
    librarian: '#10B981'
};
exports.themeColors = {
    background: exports.palette.background,
    surface: exports.palette.surface,
    text: exports.palette.textPrimary,
    success: exports.palette.success,
    warning: exports.palette.warning,
    danger: exports.palette.danger,
    disabled: exports.palette.disabled,
    border: '#E5E7EB'
};
var Colors = {
    light: {
        text: exports.palette.textPrimary,
        background: exports.palette.background,
        tint: exports.palette.primary
    },
    dark: {
        text: '#FFFFFF',
        background: '#000000',
        tint: exports.palette.primary
    },
    tint: exports.palette.primary
};
exports["default"] = Colors;
