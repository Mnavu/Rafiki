
(function($) {
    'use strict';
    $(document).ready(function() {
        alert('Custom datepicker script loaded!'); // This will confirm if the script is loaded

        // Function to add year navigation to a datepicker widget
        function addYearNavigation(widget) {
            console.log('Attempting to add year navigation to widget:', widget);
            console.log('Widget content:', widget.html()); // Log widget HTML for inspection
            if (widget.find('.year-nav').length > 0) {
                console.log('Year nav already exists for this widget. Skipping.');
                return;
            }

            var toolbar = widget.find('.datepicker-days thead tr:first');
            console.log('Found toolbar:', toolbar); // Log toolbar element
            if (toolbar.length === 0) {
                console.log('Toolbar not found for widget:', widget);
                return;
            }

            var monthSwitch = toolbar.find('.picker-switch');
            console.log('Found month switch:', monthSwitch); // Log month switch element
            if (monthSwitch.length === 0) {
                console.log('Month switch not found for toolbar:', toolbar);
                return;
            }

            console.log('Found toolbar and month switch. Adding year nav elements.');

            var prevYear = $('<th class="year-nav prev"><span class="fa fa-angle-double-left"></span></th>');
            var nextYear = $('<th class="year-nav next"><span class="fa fa-angle-double-right"></span></th>');

            prevYear.on('click', function(e) {
                e.stopPropagation();
                var pickerInstance = widget.data('DateTimePicker');
                if (pickerInstance) {
                    var newDate = pickerInstance.date().clone().subtract(1, 'y');
                    pickerInstance.date(newDate);
                    console.log('Previous year clicked. New date:', newDate.format('YYYY-MM-DD'));
                } else {
                    console.log('DateTimePicker instance not found for previous year on click.');
                }
            });

            nextYear.on('click', function(e) {
                e.stopPropagation();
                var pickerInstance = widget.data('DateTimePicker');
                if (pickerInstance) {
                    var newDate = pickerInstance.date().clone().add(1, 'y');
                    pickerInstance.date(newDate);
                    console.log('Next year clicked. New date:', newDate.format('YYYY-MM-DD'));
                } else {
                    console.log('DateTimePicker instance not found for next year on click.');
                }
            });

            monthSwitch.before(prevYear);
            monthSwitch.after(nextYear);
            console.log('Year navigation elements successfully added.');
        }

        // --- Attempt 1: Attach to dp.show event (original approach) ---
        $('body').on('dp.show', '.datepicker, .datetimepicker', function(e) {
            console.log('dp.show event fired for element:', this);
            var widget = $('.bootstrap-datetimepicker-widget'); // This will get the currently open widget
            console.log('Widget retrieved on dp.show:', widget); // Log widget on dp.show
            if (widget.length > 0) {
                addYearNavigation(widget);
            } else {
                console.log('Widget .bootstrap-datetimepicker-widget not found on dp.show event.');
            }
        });

        // --- Attempt 2: Poll for datepicker widgets (fallback/alternative) ---
        // This is to catch any datepickers that might be initialized without firing dp.show
        // or if dp.show fires before the widget is fully constructed.
        setInterval(function() {
            $('.bootstrap-datetimepicker-widget').each(function() {
                var widget = $(this);
                if (widget.is(':visible')) { // Only process visible widgets
                    console.log('Found visible datepicker widget via polling:', widget);
                    addYearNavigation(widget);
                }
            });
        }, 1000); // Check every second
    });
})(jQuery);
