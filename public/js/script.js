// public/js/script.js (or similar)
document.addEventListener('DOMContentLoaded', function() {
  const memberForm = document.getElementById('memberForm');
  if (!memberForm) return;

  const previewBtn = document.getElementById('previewBtn');
  const submitBtn = document.getElementById('submitBtn');
  const downloadBtn = document.getElementById('downloadCard');
  const printBtn = document.getElementById('printCard');
  const cardPreview = document.getElementById('cardPreview');

  let isPreviewMode = false;

  function showAlert(message, type='info') {
    // simple alert fallback
    const container = document.querySelector('.container') || document.body;
    const el = document.createElement('div');
    el.className = `alert alert-${type}`;
    el.textContent = message;
    container.prepend(el);
    setTimeout(() => el.remove(), 5000);
  }

  function generateMemberId() {
    return 'MEM' + Math.random().toString(36).substr(2, 8).toUpperCase();
  }

  // Preview button behavior (kept minimal)
  if (previewBtn) {
    previewBtn.addEventListener('click', function(e) {
      e.preventDefault();
      // validate basic required fields
      if (!memberForm.checkValidity()) {
        memberForm.reportValidity();
        return;
      }
      // toggle preview mode
      isPreviewMode = !isPreviewMode;
      previewBtn.textContent = isPreviewMode ? 'Edit Details' : 'Preview Card';
      if (isPreviewMode && submitBtn) submitBtn.style.display = 'inline-block';
      if (!isPreviewMode && submitBtn) submitBtn.style.display = 'none';
    });
  }

  // Form submit
  memberForm.addEventListener('submit', async function(e) {
    e.preventDefault();

    // require preview mode first
    if (!isPreviewMode) {
      showAlert('Please preview your card before submitting', 'warning');
      return;
    }

    const submitButton = submitBtn || memberForm.querySelector('button[type="submit"]');
    const originalText = submitButton ? submitButton.innerHTML : 'Submitting...';
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.innerHTML = 'Submitting...';
    }

    try {
      const fd = new FormData(memberForm);

      if (!fd.get('memberId')) fd.append('memberId', generateMemberId());

      // adjust this to your backend base (http://localhost:5000)
      const backendBase = (window.BACKEND_BASE_URL || '').replace(/\/$/, '') || '';
      const url = backendBase + '/api/members';

      const resp = await fetch(url, {
        method: 'POST',
        body: fd
      });

      // safeguard: check content-type before parsing JSON
      const ct = resp.headers.get('content-type') || '';
      if (!resp.ok) {
        // try parse JSON error if possible
        if (ct.includes('application/json')) {
          const errJson = await resp.json();
          throw new Error(errJson.message || 'Server error');
        } else {
          const text = await resp.text();
          throw new Error(text || 'Server returned an error (non-JSON)');
        }
      }

      if (ct.includes('application/json')) {
        const data = await resp.json();
        showAlert(data.message || 'Member submitted successfully', 'success');
        memberForm.reset();
        // optionally show generated QR or link
      } else {
        // server returned non-json but OK (rare). show raw body
        const text = await resp.text();
        showAlert('Server response: ' + text, 'info');
      }

    } catch (err) {
      console.error('Error submitting form:', err);
      showAlert(err.message || 'Failed to submit form', 'danger');
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.innerHTML = originalText;
      }
    }
  });

  // optional: download/print / html2canvas handling...
});
