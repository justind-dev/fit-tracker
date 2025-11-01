class FitTracker {
    constructor() {
        this.exercises = {}; // Keyed by date (YYYY-MM-DD)
        this.exerciseTypes = {}; // Saved exercise types with metadata
        this.currentDate = new Date();
        this.currentSession = null; // Tracks the current exercise being logged
        this.charts = {}; // Store chart instances

        this.init();
    }

    init() {
        this.loadFromStorage();
        this.bindEvents();
        this.updateDateDisplay();
        this.render();
    }

    // ========== Event Binding ==========
    bindEvents() {
        const eventMap = {
            'addExerciseBtn': ['click', () => this.openExerciseModal()],
            'closeModalBtn': ['click', () => this.closeExerciseModal()],
            'cancelBtn': ['click', () => this.closeExerciseModal()],
            'exerciseForm': ['submit', (e) => this.handleExerciseSubmit(e)],
            'finishExerciseBtn': ['click', () => this.finishExercise()],
            'prevDayBtn': ['click', () => this.changeDate(-1)],
            'nextDayBtn': ['click', () => this.changeDate(1)],
            'exerciseName': ['input', (e) => this.handleExerciseNameChange(e)],
            'exportBtn': ['click', () => this.exportData()],
            'importBtn': ['click', () => this.triggerImport()],
            'importFile': ['change', (e) => this.handleImport(e)],
            'statsBtn': ['click', () => this.openStatsModal()],
            'closeStatsBtn': ['click', () => this.closeStatsModal()],
            'updateStatsBtn': ['click', () => this.updateStatistics()]
        };

        Object.entries(eventMap).forEach(([id, [event, handler]]) => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener(event, handler);
            }
        });

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                if (e.target.id === 'exerciseModal') {
                    this.closeExerciseModal();
                } else if (e.target.id === 'statsModal') {
                    this.closeStatsModal();
                }
            }
        });
    }

    // ========== Storage Methods ==========
    loadFromStorage() {
        const storedExercises = localStorage.getItem('fitTrackerExercises');
        const storedTypes = localStorage.getItem('fitTrackerExerciseTypes');

        if (storedExercises) {
            this.exercises = JSON.parse(storedExercises);
        }

        if (storedTypes) {
            this.exerciseTypes = JSON.parse(storedTypes);
        }
    }

    saveToStorage() {
        localStorage.setItem('fitTrackerExercises', JSON.stringify(this.exercises));
        localStorage.setItem('fitTrackerExerciseTypes', JSON.stringify(this.exerciseTypes));
    }

    // ========== Date Management ==========
    changeDate(days) {
        this.currentDate.setDate(this.currentDate.getDate() + days);
        this.updateDateDisplay();
        this.render();
    }

    updateDateDisplay() {
        const dateEl = document.getElementById('currentDate');
        const today = new Date();
        const isToday = this.isSameDay(this.currentDate, today);

        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const dateStr = this.currentDate.toLocaleDateString('en-US', options);

        dateEl.textContent = isToday ? `Today - ${dateStr}` : dateStr;
    }

    isSameDay(date1, date2) {
        return date1.getFullYear() === date2.getFullYear() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getDate() === date2.getDate();
    }

    getCurrentDateKey() {
        const year = this.currentDate.getFullYear();
        const month = String(this.currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(this.currentDate.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // ========== Exercise Type Management ==========
    saveExerciseType(name, repType, bodyParts) {
        const normalizedName = name.trim().toLowerCase();

        if (!this.exerciseTypes[normalizedName]) {
            this.exerciseTypes[normalizedName] = {
                name: name.trim(),
                repType: repType,
                bodyParts: bodyParts || []
            };
            this.saveToStorage();
            this.updateExerciseDatalist();
        }
    }

    getExerciseType(name) {
        const normalizedName = name.trim().toLowerCase();
        return this.exerciseTypes[normalizedName];
    }

    updateExerciseDatalist() {
        const datalist = document.getElementById('exerciseNames');
        datalist.innerHTML = Object.values(this.exerciseTypes)
            .map(type => `<option value="${this.escapeHtml(type.name)}">`)
            .join('');
    }

    // ========== Modal Management ==========
    openExerciseModal() {
        const modal = document.getElementById('exerciseModal');
        const form = document.getElementById('exerciseForm');

        // Reset form
        form.reset();
        this.currentSession = null;

        // Hide sets section initially
        document.getElementById('setsSection').style.display = 'none';

        // Update datalist
        this.updateExerciseDatalist();

        modal.classList.add('active');
    }

    closeExerciseModal() {
        const modal = document.getElementById('exerciseModal');
        modal.classList.remove('active');

        // Re-enable fields that might have been disabled
        document.getElementById('exerciseName').disabled = false;
        document.getElementById('repType').disabled = false;

        // Reset session
        this.currentSession = null;

        // Re-render to show any newly added exercises
        this.render();
    }

    handleExerciseNameChange(e) {
        const name = e.target.value.trim();
        const exerciseType = this.getExerciseType(name);
        const bodyPartsGroup = document.getElementById('bodyPartsGroup');
        const repTypeSelect = document.getElementById('repType');

        if (exerciseType) {
            // Exercise exists - hide body parts, set rep type
            bodyPartsGroup.style.display = 'none';
            repTypeSelect.value = exerciseType.repType;
            repTypeSelect.disabled = true;
        } else {
            // New exercise - show body parts, enable rep type
            bodyPartsGroup.style.display = 'block';
            repTypeSelect.disabled = false;
        }
    }

    handleExerciseSubmit(e) {
        e.preventDefault();

        const name = document.getElementById('exerciseName').value.trim();
        const repType = document.getElementById('repType').value;
        const reps = parseFloat(document.getElementById('reps').value);
        const weightInput = document.getElementById('weight').value;
        const weight = weightInput ? parseFloat(weightInput) : null;

        if (!name || !reps) return;

        // Check if this is a new exercise type
        let exerciseType = this.getExerciseType(name);

        if (!exerciseType) {
            // Get selected body parts
            const bodyParts = Array.from(document.querySelectorAll('input[name="bodyPart"]:checked'))
                .map(cb => cb.value);

            // Save new exercise type
            this.saveExerciseType(name, repType, bodyParts);
            exerciseType = this.getExerciseType(name);
        }

        // If no current session, create one
        if (!this.currentSession) {
            this.currentSession = {
                name: exerciseType.name,
                repType: exerciseType.repType,
                bodyParts: exerciseType.bodyParts,
                sets: [],
                timestamp: new Date().toISOString()
            };
        }

        // Add set to current session
        this.currentSession.sets.push({
            reps: reps,
            weight: weight
        });

        // Update UI
        this.displayCurrentSets();

        // Clear reps and weight fields for next set
        document.getElementById('reps').value = '';
        document.getElementById('weight').value = '';
        document.getElementById('reps').focus();
    }

    displayCurrentSets() {
        const setsSection = document.getElementById('setsSection');
        const setsList = document.getElementById('setsList');

        setsSection.style.display = 'block';

        setsList.innerHTML = this.currentSession.sets.map((set, index) => {
            const weightStr = set.weight ? ` @ ${set.weight} lbs` : '';
            return `
                <div class="set-item">
                    <div class="set-info">
                        <span class="set-number">Set ${index + 1}</span>
                        <span class="set-details">${set.reps} ${this.currentSession.repType}${weightStr}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    finishExercise() {
        if (!this.currentSession || this.currentSession.sets.length === 0) return;

        // Get date key
        const dateKey = this.getCurrentDateKey();

        // Check if we're adding to an existing exercise
        if (this.currentSession.existingExerciseId) {
            const exercise = this.exercises[dateKey].find(ex => ex.id === this.currentSession.existingExerciseId);
            if (exercise) {
                // Add new sets to existing exercise
                exercise.sets.push(...this.currentSession.sets);
                exercise.timestamp = new Date().toISOString(); // Update timestamp
            }
        } else {
            // Initialize exercises array for this date if needed
            if (!this.exercises[dateKey]) {
                this.exercises[dateKey] = [];
            }

            // Add new exercise to the date
            this.exercises[dateKey].push({
                id: Date.now().toString(),
                name: this.currentSession.name,
                repType: this.currentSession.repType,
                bodyParts: this.currentSession.bodyParts,
                sets: this.currentSession.sets,
                timestamp: this.currentSession.timestamp
            });
        }

        // Save and close
        this.saveToStorage();
        this.closeExerciseModal();
    }

    // ========== Exercise Management ==========
    deleteExercise(exerciseId) {
        const dateKey = this.getCurrentDateKey();
        if (!this.exercises[dateKey]) return;

        this.exercises[dateKey] = this.exercises[dateKey].filter(ex => ex.id !== exerciseId);

        // Remove the date key if no exercises left
        if (this.exercises[dateKey].length === 0) {
            delete this.exercises[dateKey];
        }

        this.saveToStorage();
        this.render();
    }

    deleteSet(exerciseId, setIndex) {
        const dateKey = this.getCurrentDateKey();
        if (!this.exercises[dateKey]) return;

        const exercise = this.exercises[dateKey].find(ex => ex.id === exerciseId);
        if (!exercise) return;

        exercise.sets.splice(setIndex, 1);

        // If no sets left, delete the entire exercise
        if (exercise.sets.length === 0) {
            this.deleteExercise(exerciseId);
            return;
        }

        this.saveToStorage();
        this.render();
    }

    addMoreSets(exerciseId) {
        const dateKey = this.getCurrentDateKey();
        if (!this.exercises[dateKey]) return;

        const exercise = this.exercises[dateKey].find(ex => ex.id === exerciseId);
        if (!exercise) return;

        // Set up current session with the existing exercise
        this.currentSession = {
            existingExerciseId: exerciseId,
            name: exercise.name,
            repType: exercise.repType,
            bodyParts: exercise.bodyParts,
            sets: []
        };

        // Open modal and pre-fill
        const modal = document.getElementById('exerciseModal');
        const form = document.getElementById('exerciseForm');

        form.reset();

        document.getElementById('exerciseName').value = exercise.name;
        document.getElementById('repType').value = exercise.repType;

        // Trigger the name change to set up the form correctly
        this.handleExerciseNameChange({ target: document.getElementById('exerciseName') });

        // Hide body parts group
        document.getElementById('bodyPartsGroup').style.display = 'none';

        // Disable exercise name and rep type
        document.getElementById('exerciseName').disabled = true;
        document.getElementById('repType').disabled = true;

        modal.classList.add('active');
    }

    // ========== Rendering ==========
    render() {
        const exercisesList = document.getElementById('exercisesList');
        const dateKey = this.getCurrentDateKey();
        const dayExercises = this.exercises[dateKey] || [];

        if (dayExercises.length === 0) {
            exercisesList.innerHTML = `
                <div class="empty-state">
                    <h3>No exercises logged yet</h3>
                    <p>Tap the button above to log your first exercise!</p>
                </div>
            `;
            return;
        }

        exercisesList.innerHTML = dayExercises
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .map(exercise => this.renderExerciseCard(exercise))
            .join('');
    }

    renderExerciseCard(exercise) {
        const bodyPartsHtml = exercise.bodyParts.length > 0 ? `
            <div class="body-parts">
                ${exercise.bodyParts.map(part =>
                    `<span class="body-part-tag">${this.escapeHtml(part)}</span>`
                ).join('')}
            </div>
        ` : '';

        const setsHtml = exercise.sets.map((set, index) => {
            const weightStr = set.weight ? ` @ ${set.weight} lbs` : '';
            return `
                <div class="set-item">
                    <div class="set-info">
                        <span class="set-number">Set ${index + 1}</span>
                        <span class="set-details">${set.reps} ${exercise.repType}${weightStr}</span>
                    </div>
                    <button class="icon-btn delete" title="Delete Set" onclick="tracker.deleteSet('${exercise.id}', ${index})">
                        🗑️
                    </button>
                </div>
            `;
        }).join('');

        // Calculate total reps
        const totalReps = exercise.sets.reduce((sum, set) => sum + set.reps, 0);
        const totalSets = exercise.sets.length;

        return `
            <div class="exercise-card" data-id="${exercise.id}">
                <div class="exercise-header">
                    <div>
                        <h3 class="exercise-name">${this.escapeHtml(exercise.name)}</h3>
                        ${bodyPartsHtml}
                    </div>
                    <div class="exercise-actions">
                        <button class="icon-btn add" title="Add More Sets" onclick="tracker.addMoreSets('${exercise.id}')">
                            +
                        </button>
                        <button class="icon-btn delete" title="Delete Exercise" onclick="tracker.deleteExercise('${exercise.id}')">
                            🗑️
                        </button>
                    </div>
                </div>
                <div class="exercise-summary">
                    <span>${totalSets} sets</span>
                    <span>${totalReps} total ${exercise.repType}</span>
                </div>
                <div class="sets-container">
                    ${setsHtml}
                </div>
            </div>
        `;
    }

    // ========== Statistics Methods ==========
    openStatsModal() {
        const modal = document.getElementById('statsModal');

        // Set date inputs to current date
        const dateKey = this.getCurrentDateKey();
        document.getElementById('statsStartDate').value = dateKey;
        document.getElementById('statsEndDate').value = dateKey;

        modal.classList.add('active');

        // Generate statistics after modal opens
        setTimeout(() => this.updateStatistics(), 100);
    }

    closeStatsModal() {
        const modal = document.getElementById('statsModal');
        modal.classList.remove('active');

        // Destroy all charts
        Object.values(this.charts).forEach(chart => chart.destroy());
        this.charts = {};
    }

    updateStatistics() {
        const startDate = document.getElementById('statsStartDate').value;
        const endDate = document.getElementById('statsEndDate').value;

        if (!startDate || !endDate) {
            alert('Please select both start and end dates.');
            return;
        }

        // Get exercises in date range
        const exercisesInRange = this.getExercisesInDateRange(startDate, endDate);

        // Calculate statistics
        const stats = this.calculateStatistics(exercisesInRange);

        // Update summary
        document.getElementById('totalExercises').textContent = stats.totalExercises;
        document.getElementById('totalSets').textContent = stats.totalSets;
        document.getElementById('totalWeight').textContent = `${stats.totalWeight.toFixed(1)} lbs`;

        // Generate charts
        this.generateCharts(stats);
    }

    getExercisesInDateRange(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const exercises = [];

        // Iterate through all dates in range
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateKey = this.formatDateKey(d);
            if (this.exercises[dateKey]) {
                exercises.push(...this.exercises[dateKey]);
            }
        }

        return exercises;
    }

    formatDateKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    calculateStatistics(exercises) {
        const stats = {
            totalExercises: exercises.length,
            totalSets: 0,
            totalWeight: 0,
            bodyPartCounts: {},
            bodyPartReps: {},
            weightByExercise: {},
            setsByExercise: {}
        };

        exercises.forEach(exercise => {
            stats.totalSets += exercise.sets.length;

            // Count by body parts
            exercise.bodyParts.forEach(part => {
                stats.bodyPartCounts[part] = (stats.bodyPartCounts[part] || 0) + 1;
                stats.bodyPartReps[part] = (stats.bodyPartReps[part] || 0);
            });

            // Weight by exercise
            stats.weightByExercise[exercise.name] = stats.weightByExercise[exercise.name] || 0;
            stats.setsByExercise[exercise.name] = (stats.setsByExercise[exercise.name] || 0) + exercise.sets.length;

            // Calculate total weight and reps
            exercise.sets.forEach(set => {
                if (set.weight) {
                    const weightMoved = set.weight * set.reps;
                    stats.totalWeight += weightMoved;
                    stats.weightByExercise[exercise.name] += weightMoved;
                }

                // Add reps to body parts
                exercise.bodyParts.forEach(part => {
                    stats.bodyPartReps[part] += set.reps;
                });
            });
        });

        return stats;
    }

    generateCharts(stats) {
        // Destroy existing charts
        Object.values(this.charts).forEach(chart => chart.destroy());
        this.charts = {};

        const chartColors = [
            'rgba(123, 44, 191, 0.8)',  // purple
            'rgba(58, 134, 255, 0.8)',  // blue
            'rgba(6, 255, 165, 0.8)',   // green
            'rgba(255, 190, 11, 0.8)',  // yellow
            'rgba(255, 0, 110, 0.8)',   // pink
            'rgba(157, 78, 221, 0.8)',  // light purple
            'rgba(72, 149, 239, 0.8)',  // light blue
            'rgba(0, 255, 136, 0.8)'    // light green
        ];

        // Chart 1: Exercises by Body Part (Pie)
        if (Object.keys(stats.bodyPartCounts).length > 0) {
            const ctx1 = document.getElementById('bodyPartExerciseChart').getContext('2d');
            this.charts.bodyPartExercise = new Chart(ctx1, {
                type: 'pie',
                data: {
                    labels: Object.keys(stats.bodyPartCounts),
                    datasets: [{
                        data: Object.values(stats.bodyPartCounts),
                        backgroundColor: chartColors
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { color: '#e8e8e8', padding: 10, font: { size: 11 } }
                        }
                    }
                }
            });
        }

        // Chart 2: Total Reps by Body Part (Bar)
        if (Object.keys(stats.bodyPartReps).length > 0) {
            const ctx2 = document.getElementById('bodyPartRepsChart').getContext('2d');
            this.charts.bodyPartReps = new Chart(ctx2, {
                type: 'bar',
                data: {
                    labels: Object.keys(stats.bodyPartReps),
                    datasets: [{
                        label: 'Total Reps',
                        data: Object.values(stats.bodyPartReps),
                        backgroundColor: chartColors[0]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { color: '#e8e8e8' },
                            grid: { color: 'rgba(255, 255, 255, 0.1)' }
                        },
                        x: {
                            ticks: { color: '#e8e8e8' },
                            grid: { color: 'rgba(255, 255, 255, 0.05)' }
                        }
                    }
                }
            });
        }

        // Chart 3: Total Weight by Exercise (Bar)
        if (Object.keys(stats.weightByExercise).length > 0) {
            const ctx3 = document.getElementById('weightByExerciseChart').getContext('2d');
            this.charts.weightByExercise = new Chart(ctx3, {
                type: 'bar',
                data: {
                    labels: Object.keys(stats.weightByExercise),
                    datasets: [{
                        label: 'Total Weight (lbs)',
                        data: Object.values(stats.weightByExercise),
                        backgroundColor: chartColors[2]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { color: '#e8e8e8' },
                            grid: { color: 'rgba(255, 255, 255, 0.1)' }
                        },
                        x: {
                            ticks: { color: '#e8e8e8', maxRotation: 45, minRotation: 45 },
                            grid: { color: 'rgba(255, 255, 255, 0.05)' }
                        }
                    }
                }
            });
        }

        // Chart 4: Sets by Exercise (Bar)
        if (Object.keys(stats.setsByExercise).length > 0) {
            const ctx4 = document.getElementById('setsByExerciseChart').getContext('2d');
            this.charts.setsByExercise = new Chart(ctx4, {
                type: 'bar',
                data: {
                    labels: Object.keys(stats.setsByExercise),
                    datasets: [{
                        label: 'Total Sets',
                        data: Object.values(stats.setsByExercise),
                        backgroundColor: chartColors[1]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { color: '#e8e8e8' },
                            grid: { color: 'rgba(255, 255, 255, 0.1)' }
                        },
                        x: {
                            ticks: { color: '#e8e8e8', maxRotation: 45, minRotation: 45 },
                            grid: { color: 'rgba(255, 255, 255, 0.05)' }
                        }
                    }
                }
            });
        }
    }

    // ========== Backup/Restore Methods ==========
    exportData() {
        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            exercises: this.exercises,
            exerciseTypes: this.exerciseTypes
        };

        const filename = `fit-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
        const dataStr = JSON.stringify(exportData, null, 2);

        // Create download link
        const dataUrl = "data:text/json;charset=utf-8," + encodeURIComponent(dataStr);
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = filename;
        link.style.display = 'none';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    triggerImport() {
        const importFile = document.getElementById('importFile');
        if (importFile) {
            importFile.click();
        }
    }

    handleImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importData = JSON.parse(e.target.result);

                if (!importData.exercises || !importData.exerciseTypes) {
                    alert('Invalid backup file format. Missing required data.');
                    return;
                }

                // Confirm with user before replacing data
                const confirmReplace = confirm(
                    'This will replace all your current data with the backup. Continue?'
                );

                if (confirmReplace) {
                    this.exercises = importData.exercises;
                    this.exerciseTypes = importData.exerciseTypes;
                    this.saveToStorage();
                    this.updateExerciseDatalist();
                    this.render();
                    alert('Backup restored successfully!');
                }
            } catch (error) {
                alert('Failed to import backup. Please check the file format.');
                console.error('Import error:', error);
            }

            // Reset file input
            event.target.value = '';
        };

        reader.readAsText(file);
    }

    // ========== Utility Methods ==========
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the app when DOM is loaded
let tracker;
document.addEventListener('DOMContentLoaded', () => {
    tracker = new FitTracker();
});
