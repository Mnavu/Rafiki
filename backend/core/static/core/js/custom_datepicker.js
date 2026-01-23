// Wait for the entire page to load, including all scripts and stylesheets.
// This is more robust than document.ready() for complex admin pages.
window.addEventListener('load', function() {
    
    /**
     * Initializes Flatpickr on a given element.
     * @param {HTMLElement} element The input element to attach the datepicker to.
     */
    function initializeFlatpickr(element) {
        // The second argument is the configuration object.
        flatpickr(element, {
            dateFormat: "Y-m-d", // Format the date as YYYY-MM-DD
            allowInput: true,     // Allows users to type a date directly
        });
    }

    // --- Initializer for Datepickers ---

    // Find all elements with our custom class and initialize Flatpickr on them.
    var dateInputs = document.querySelectorAll('.flatpickr-date-input');
    for (var i = 0; i < dateInputs.length; i++) {
        initializeFlatpickr(dateInputs[i]);
    }

    // --- Django Formset Support ---

    // Use jQuery for formset support as Django's events are jQuery-based.
    if (typeof django !== 'undefined' && typeof django.jQuery !== 'undefined') {
        django.jQuery(document).on('formset:added', function(event, row) {
            // Find the new date input in the added row and initialize it.
            var newDateInput = row.find('.flatpickr-date-input');
            if (newDateInput.length > 0) {
                initializeFlatpickr(newDateInput[0]);
            }
        });
    }

});
