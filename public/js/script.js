// public/js/script.js
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('memberForm');
    if (!form) return;

    // Function to show alert message
    function showAlert(message, type = 'info') {
        // Remove any existing alerts first
        const existingAlert = document.querySelector('.alert');
        if (existingAlert) {
            existingAlert.remove();
        }

        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show mt-3`;
        alertDiv.role = 'alert';
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        // Insert alert at the top of the form
        form.insertBefore(alertDiv, form.firstChild);
        
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            const bsAlert = new bootstrap.Alert(alertDiv);
            bsAlert.close();
        }, 5000);
    }

    // Handle form submission
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        console.log('Form submission started');

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        
        try {
            // Show loading state
            submitBtn.disabled = true;
            submitBtn.innerHTML = `
                <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                <span class="visually-hidden">Submitting...</span>
                Submitting...
            `;
            
            // Create FormData from form
            const formData = new FormData(form);
            console.log('Form data:', Object.fromEntries(formData.entries()));

            // Send the request with credentials
            const response = await fetch('/api/members', {
                method: 'POST',
                body: formData,
                headers: {
                    'Accept': 'application/json'
                },
                credentials: 'same-origin' // Include cookies with the request
            });

            console.log('Response status:', response.status);
            
            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('Expected JSON, got:', text);
                throw new Error('Invalid response from server');
            }
            
            const result = await response.json();
            console.log('Response data:', result);

            if (!response.ok) {
                throw new Error(result.message || 'Failed to submit form');
            }

            // Show success message
            showAlert('Member submitted successfully!', 'success');
            
            // Reset form
            form.reset();
            
            // Scroll to top to show success message
            window.scrollTo({ top: 0, behavior: 'smooth' });

        } catch (error) {
            console.error('Form submission error:', error);
            
            // Show error message
            const errorMessage = error.message || 'An error occurred while submitting the form. Please try again.';
            showAlert(errorMessage, 'danger');
            
        } finally {
            // Reset button state
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    });

    // Add input validation
    const validateField = (input, validationFn, errorMessage) => {
        const isValid = validationFn(input.value);
        
        // Remove existing feedback
        const existingFeedback = input.nextElementSibling;
        if (existingFeedback && existingFeedback.classList.contains('invalid-feedback')) {
            existingFeedback.remove();
        }
        
        input.classList.remove('is-invalid', 'is-valid');
        
        if (!isValid) {
            input.classList.add('is-invalid');
            const errorDiv = document.createElement('div');
            errorDiv.className = 'invalid-feedback';
            errorDiv.textContent = errorMessage;
            input.parentNode.insertBefore(errorDiv, input.nextSibling);
            return false;
        } else {
            input.classList.add('is-valid');
            return true;
        }
    };

    // Add form validation
    const requiredFields = form.querySelectorAll('[required]');
    requiredFields.forEach(field => {
        field.addEventListener('blur', () => {
            validateField(field, value => value.trim() !== '', 'This field is required');
        });
    });

    // Email validation
    const emailField = form.querySelector('input[type="email"]');
    if (emailField) {
        emailField.addEventListener('blur', () => {
            validateField(
                emailField, 
                value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), 
                'Please enter a valid email address'
            );
        });
    }

    // Phone validation
    const phoneField = form.querySelector('input[type="tel"]');
    if (phoneField) {
        phoneField.addEventListener('blur', () => {
            validateField(
                phoneField,
                value => /^[0-9+\-\s()]{8,20}$/.test(value),
                'Please enter a valid phone number'
            );
        });
    }
});
