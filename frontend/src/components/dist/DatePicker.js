"use strict";
exports.__esModule = true;
var react_1 = require("react");
var react_native_1 = require("react-native");
var colors_1 = require("../theme/colors");
var vector_icons_1 = require("@expo/vector-icons");
var DatePicker = function (_a) {
    var value = _a.value, onChange = _a.onChange, _b = _a.placeholder, placeholder = _b === void 0 ? 'Select Date' : _b, style = _a.style, textStyle = _a.textStyle, _c = _a.disabled, disabled = _c === void 0 ? false : _c;
    var _d = react_1.useState(false), show = _d[0], setShow = _d[1];
    var _e = react_1.useState(value || new Date()), currentDate = _e[0], setCurrentDate = _e[1];
    var toggleShow = function () {
        if (!disabled) {
            setShow(!show);
        }
    };
    var handleDateChange = function (day) {
        var newDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        onChange({}, newDate);
        setShow(false);
    };
    var changeMonth = function (amount) {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + amount, 1));
    };
    var changeYear = function (amount) {
        setCurrentDate(new Date(currentDate.getFullYear() + amount, currentDate.getMonth(), 1));
    };
    var renderHeader = function () {
        return (react_1["default"].createElement(react_native_1.View, { style: styles.header },
            react_1["default"].createElement(react_native_1.TouchableOpacity, { onPress: function () { return changeYear(-1); } },
                react_1["default"].createElement(vector_icons_1.Ionicons, { name: "chevron-back-outline", size: 24, color: colors_1["default"].light.text })),
            react_1["default"].createElement(react_native_1.TouchableOpacity, { onPress: function () { return changeMonth(-1); } },
                react_1["default"].createElement(vector_icons_1.Ionicons, { name: "arrow-back-outline", size: 24, color: colors_1["default"].light.text })),
            react_1["default"].createElement(react_native_1.Text, { style: styles.headerText }, currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })),
            react_1["default"].createElement(react_native_1.TouchableOpacity, { onPress: function () { return changeMonth(1); } },
                react_1["default"].createElement(vector_icons_1.Ionicons, { name: "arrow-forward-outline", size: 24, color: colors_1["default"].light.text })),
            react_1["default"].createElement(react_native_1.TouchableOpacity, { onPress: function () { return changeYear(1); } },
                react_1["default"].createElement(vector_icons_1.Ionicons, { name: "chevron-forward-outline", size: 24, color: colors_1["default"].light.text }))));
    };
    var renderDaysOfWeek = function () {
        var days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
        return (react_1["default"].createElement(react_native_1.View, { style: styles.daysOfWeek }, days.map(function (day, index) { return (react_1["default"].createElement(react_native_1.Text, { key: index, style: styles.dayOfWeekText }, day)); })));
    };
    var renderDays = function () {
        var year = currentDate.getFullYear();
        var month = currentDate.getMonth();
        var firstDayOfMonth = new Date(year, month, 1).getDay();
        var daysInMonth = new Date(year, month + 1, 0).getDate();
        var days = [];
        for (var i = 0; i < firstDayOfMonth; i++) {
            days.push(react_1["default"].createElement(react_native_1.View, { key: "empty-" + i, style: styles.day }));
        }
        var _loop_1 = function (day) {
            var isSelected = value && day === value.getDate() && month === value.getMonth() && year === value.getFullYear();
            days.push(react_1["default"].createElement(react_native_1.TouchableOpacity, { key: day, style: [styles.day, isSelected && styles.selectedDay], onPress: function () { return handleDateChange(day); } },
                react_1["default"].createElement(react_native_1.Text, { style: isSelected && styles.selectedDayText }, day)));
        };
        for (var day = 1; day <= daysInMonth; day++) {
            _loop_1(day);
        }
        return react_1["default"].createElement(react_native_1.View, { style: styles.daysContainer }, days);
    };
    var formattedDate = value ? value.toLocaleDateString() : placeholder;
    return (react_1["default"].createElement(react_native_1.View, { style: [styles.container, style] },
        react_1["default"].createElement(react_native_1.TouchableOpacity, { onPress: toggleShow, disabled: disabled, style: styles.touchable },
            react_1["default"].createElement(react_native_1.Text, { style: [styles.dateText, textStyle, disabled && styles.disabledText] }, value ? formattedDate : placeholder)),
        react_1["default"].createElement(react_native_1.Modal, { transparent: true, animationType: "slide", visible: show, onRequestClose: toggleShow },
            react_1["default"].createElement(react_native_1.Pressable, { style: styles.modalOverlay, onPress: toggleShow },
                react_1["default"].createElement(react_native_1.View, { style: styles.modalContent },
                    renderHeader(),
                    renderDaysOfWeek(),
                    renderDays())))));
};
var styles = react_native_1.StyleSheet.create({
    container: {},
    touchable: {
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: colors_1["default"].light.text,
        borderRadius: 8,
        backgroundColor: colors_1["default"].light.background
    },
    dateText: {
        fontSize: 16,
        color: colors_1["default"].light.text
    },
    disabledText: {
        color: colors_1["default"].dark.text
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)'
    },
    modalContent: {
        width: '90%',
        backgroundColor: colors_1["default"].light.background,
        borderRadius: 10,
        padding: 20,
        alignItems: 'center'
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        marginBottom: 10
    },
    headerText: {
        fontSize: 18,
        fontWeight: 'bold'
    },
    daysOfWeek: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
        marginBottom: 10
    },
    dayOfWeekText: {
        width: 30,
        textAlign: 'center',
        color: colors_1["default"].light.text
    },
    daysContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        width: '100%'
    },
    day: {
        width: '14.2%',
        aspectRatio: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    selectedDay: {
        backgroundColor: colors_1["default"].tint,
        borderRadius: 20
    },
    selectedDayText: {
        color: '#fff'
    }
});
exports["default"] = DatePicker;
