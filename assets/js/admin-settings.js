/**
 * MagicPlugins shared settings page interactions.
 * Enqueued only on the MagicPlugins settings screen.
 */
document.addEventListener('DOMContentLoaded', function () {
    // Menu position type toggle
    var positionType = document.getElementById('menu-position-type');
    var relativeWrapper = document.getElementById('relative-position-wrapper');
    var customWrapper = document.getElementById('custom-position-wrapper');

    if (positionType && relativeWrapper && customWrapper) {
        positionType.addEventListener('change', function () {
            relativeWrapper.style.display = this.value === 'relative' ? 'block' : 'none';
            customWrapper.style.display = this.value === 'custom' ? 'block' : 'none';
        });
    }

    // Simple drag-and-drop ordering for the submenu items
    var sortable = document.getElementById('submenu-sortable');
    if (sortable) {
        var draggedElement = null;

        sortable.addEventListener('dragstart', function (e) {
            draggedElement = e.target;
            e.target.style.opacity = '0.5';
        });

        sortable.addEventListener('dragend', function (e) {
            e.target.style.opacity = '';
            draggedElement = null;
        });

        sortable.addEventListener('dragover', function (e) {
            e.preventDefault();
        });

        sortable.addEventListener('drop', function (e) {
            e.preventDefault();
            if (draggedElement && e.target !== draggedElement && e.target.tagName === 'LI') {
                var rect = e.target.getBoundingClientRect();
                var next = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;
                sortable.insertBefore(draggedElement, next ? e.target.nextSibling : e.target);
            }
        });

        var items = sortable.querySelectorAll('li');
        items.forEach(function (item) {
            item.draggable = true;
        });
    }
});
