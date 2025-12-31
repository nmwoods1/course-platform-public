(function initDebugDrawer() {
            const toggleBtn = document.getElementById('debugToggle');
            const clearBtn = document.getElementById('debugClear');
            const copyBtn = document.getElementById('debugCopy');
            const panel = document.getElementById('debugPanel');
            const logEl = document.getElementById('debugLog');
            const summaryEl = document.getElementById('debugSummary');

            if (!toggleBtn || !panel || !logEl || !summaryEl) return;

            const MAX_LINES = 500;
            const lines = [];

            function formatArg(arg) {
                if (arg instanceof Error) return arg.stack || `${arg.name}: ${arg.message}`;
                if (typeof arg === 'string') return arg;
                try {
                    return JSON.stringify(arg, null, 2);
                } catch {
                    return String(arg);
                }
            }

            function addLine(level, args) {
                const ts = new Date().toISOString().split('T')[1].replace('Z', '');
                const msg = args.map(formatArg).join(' ');
                const line = `[${ts}] ${level.toUpperCase()}: ${msg}`;
                lines.push({ level, line });
                if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);

                // Render (simple + fast enough for small MAX_LINES)
                logEl.innerHTML = lines
                    .map(({ level: lvl, line: ln }) => {
                        const cls = lvl === 'error' ? 'debug-line--error' : (lvl === 'warn' ? 'debug-line--warn' : 'debug-line--log');
                        const escaped = ln
                            .replaceAll('&', '&amp;')
                            .replaceAll('<', '&lt;')
                            .replaceAll('>', '&gt;');
                        return `<span class="${cls}">${escaped}</span>`;
                    })
                    .join('\n');

                summaryEl.textContent = msg || summaryEl.textContent;
                panel.scrollTop = panel.scrollHeight;
            }

            function setOpen(open) {
                panel.classList.toggle('hidden', !open);
                toggleBtn.textContent = open ? 'Hide debug' : 'Show debug';
                localStorage.setItem('debugDrawerOpen', open ? '1' : '0');
            }

            toggleBtn.addEventListener('click', () => setOpen(panel.classList.contains('hidden')));
            clearBtn.addEventListener('click', () => {
                lines.splice(0, lines.length);
                logEl.textContent = '';
                summaryEl.textContent = 'Cleared';
            });
            copyBtn.addEventListener('click', async () => {
                const text = lines.map(l => l.line).join('\n');
                try {
                    await navigator.clipboard.writeText(text);
                    summaryEl.textContent = 'Copied to clipboard';
                } catch (e) {
                    // Fallback: show text length; user can long-press to select/copy from the panel
                    summaryEl.textContent = `Copy failed (${String(e && e.message ? e.message : e)}). Open the panel and long-press to copy.`;
                    setOpen(true);
                }
            });

            // Patch console to mirror to drawer
            const original = {
                log: console.log.bind(console),
                warn: console.warn.bind(console),
                error: console.error.bind(console)
            };

            console.log = (...args) => { original.log(...args); addLine('log', args); };
            console.warn = (...args) => { original.warn(...args); addLine('warn', args); };
            console.error = (...args) => { original.error(...args); addLine('error', args); };

            window.addEventListener('error', (e) => {
                addLine('error', [
                    `Uncaught error: ${e.message}`,
                    e.filename ? `(${e.filename}:${e.lineno}:${e.colno})` : ''
                ]);
            });
            window.addEventListener('unhandledrejection', (e) => {
                addLine('error', ['Unhandled promise rejection:', e.reason]);
            });

            // Initial state
            const open = localStorage.getItem('debugDrawerOpen') === '1';
            setOpen(open);
            addLine('log', ['Debug drawer initialized']);
        })();

        // ============================================
        // CONFIGURATION - EDIT THESE TWO LINES
        // ============================================
        const SUPABASE_URL = 'https://rvkrvidceablmhblcave.supabase.co';
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2a3J2aWRjZWFibG1oYmxjYXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxMjQ5NzIsImV4cCI6MjA4MjcwMDk3Mn0.V9n0UJVgr3Ee3RJpLrQibolA_GgEdp3V0iIcr1a9sII';
        // ============================================

        function showSetupScreen(message) {
            const setup = document.getElementById('setupScreen');
            setup.classList.remove('hidden');
            document.getElementById('mainApp').classList.add('hidden');

            if (message) {
                const card = setup.querySelector('.card');
                const existing = setup.querySelector('#setupError');
                if (existing) existing.remove();

                const warning = document.createElement('div');
                warning.id = 'setupError';
                warning.style.marginBottom = '16px';
                warning.style.padding = '12px';
                warning.style.borderRadius = '8px';
                warning.style.background = 'rgba(245, 101, 101, 0.2)';
                warning.style.border = '1px solid rgba(245, 101, 101, 0.5)';
                warning.innerHTML = `<strong>Unable to start the app:</strong><br>${message}`;
                card.insertBefore(warning, card.children[1]);
            }
        }

        // Initialize Supabase only when configured (avoids "Invalid URL" errors in setup mode)
        let supabase = null;

        // Check if configured
        if (SUPABASE_URL === 'YOUR_SUPABASE_URL_HERE' || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY_HERE') {
            showSetupScreen(null);
        } else {
            // If the Supabase CDN script didn't load (offline / blocked), don't fail blank.
            if (!window.supabase || typeof window.supabase.createClient !== 'function') {
                showSetupScreen('The Supabase library failed to load. If you are opening this file locally, try again with an internet connection (or host it and allow loading from jsdelivr).');
            } else {
                try {
                    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                    document.getElementById('mainApp').classList.remove('hidden');
                    initializeApp();
                } catch (e) {
                    console.error('Supabase initialization failed:', e);
                    showSetupScreen(`Supabase initialization failed: ${String(e && e.message ? e.message : e)}`);
                }
            }
        }

        // Course Data
        const lessons = [
            {
                id: '01-intro',
                title: 'Introduction to Breathing',
                description: 'Learn the basics of mindful breathing',
                duration: 5,
                order: 1,
                content: `
                    <h2>Welcome to Mindful Breathing</h2>
                    <p>Breathing is the foundation of mindfulness. This course will teach you simple, effective techniques you can practice anywhere.</p>
                    
                    <h3>What You'll Learn</h3>
                    <ul>
                        <li>Basic breathing patterns</li>
                        <li>How to reduce stress through breathing</li>
                        <li>Building a daily practice</li>
                    </ul>

                    <h3>Why Breathing Matters</h3>
                    <p>Your breath is always with you. Learning to control it gives you a tool for:</p>
                    <ul>
                        <li>Reducing anxiety</li>
                        <li>Improving focus</li>
                        <li>Better sleep</li>
                        <li>Increased energy</li>
                    </ul>

                    <h3>Quick Exercise</h3>
                    <p>Try this now:</p>
                    <ol>
                        <li>Breathe in for 4 counts</li>
                        <li>Hold for 4 counts</li>
                        <li>Breathe out for 4 counts</li>
                        <li>Repeat 3 times</li>
                    </ol>
                    <p>Notice how you feel afterward.</p>
                `,
                quiz: [
                    {
                        question: "How long should you practice daily?",
                        options: ["5 minutes", "10 minutes", "30 minutes"],
                        correct: 0
                    },
                    {
                        question: "Where is the best place to practice?",
                        options: ["Anywhere", "Only at home", "Only outside"],
                        correct: 0
                    }
                ]
            },
            {
                id: '02-basics',
                title: 'Basic Techniques',
                description: 'Core breathing exercises',
                duration: 10,
                order: 2,
                content: `
                    <h2>Basic Breathing Techniques</h2>
                    <p>Now that you understand the importance of breathing, let's learn some fundamental techniques.</p>

                    <h3>Box Breathing</h3>
                    <p>Used by Navy SEALs to stay calm under pressure:</p>
                    <ol>
                        <li><strong>Inhale</strong> for 4 seconds</li>
                        <li><strong>Hold</strong> for 4 seconds</li>
                        <li><strong>Exhale</strong> for 4 seconds</li>
                        <li><strong>Hold</strong> for 4 seconds</li>
                        <li>Repeat 4 times</li>
                    </ol>

                    <h3>4-7-8 Breathing</h3>
                    <p>Perfect for falling asleep:</p>
                    <ol>
                        <li><strong>Exhale</strong> completely through your mouth</li>
                        <li><strong>Inhale</strong> through nose for 4 counts</li>
                        <li><strong>Hold</strong> for 7 counts</li>
                        <li><strong>Exhale</strong> through mouth for 8 counts</li>
                        <li>Repeat 4 times</li>
                    </ol>

                    <h3>Diaphragmatic Breathing</h3>
                    <ol>
                        <li>Place one hand on chest, one on belly</li>
                        <li>Breathe so only belly hand moves</li>
                        <li>Chest should stay relatively still</li>
                        <li>Practice for 5 minutes</li>
                    </ol>

                    <p>Try each technique and see which resonates with you.</p>
                `,
                quiz: [
                    {
                        question: "What is the 4-7-8 technique?",
                        options: ["Inhale 4, hold 7, exhale 8", "Repeat 4 times, 7 days, 8 weeks", "4 breaths, 7 minutes, 8 hours"],
                        correct: 0
                    }
                ]
            },
            {
                id: '03-practice',
                title: 'Daily Practice',
                description: 'Building your routine',
                duration: 8,
                order: 3,
                content: `
                    <h2>Building Your Daily Practice</h2>
                    <p>Consistency is key. Here's how to make breathing exercises a habit.</p>

                    <h3>Creating Your Routine</h3>
                    <p><strong>Start Small</strong></p>
                    <ul>
                        <li>5 minutes per day</li>
                        <li>Same time each day</li>
                        <li>Same location if possible</li>
                    </ul>

                    <p><strong>Gradually Increase</strong></p>
                    <ul>
                        <li>Week 1-2: 5 minutes</li>
                        <li>Week 3-4: 10 minutes</li>
                        <li>Month 2+: 15-20 minutes</li>
                    </ul>

                    <h3>Best Times to Practice</h3>
                    <ul>
                        <li><strong>Morning:</strong> Energize your day</li>
                        <li><strong>Lunch:</strong> Midday reset</li>
                        <li><strong>Evening:</strong> Wind down</li>
                        <li><strong>Bedtime:</strong> Improve sleep</li>
                    </ul>

                    <h3>Tracking Progress</h3>
                    <p>Notice improvements in:</p>
                    <ul>
                        <li>Sleep quality</li>
                        <li>Stress levels</li>
                        <li>Focus and clarity</li>
                        <li>Overall well-being</li>
                    </ul>

                    <h3>Common Challenges</h3>
                    <p><strong>"I forget to practice"</strong><br>
                    → Set a daily reminder on your phone</p>

                    <p><strong>"I don't have time"</strong><br>
                    → Even 2 minutes helps. Do it while waiting for coffee.</p>

                    <p><strong>"My mind wanders"</strong><br>
                    → Normal! Gently bring attention back to breath.</p>

                    <p style="margin-top: 32px; font-weight: 600; color: #667eea;">You've completed the course! Remember: consistency beats perfection.</p>
                `,
                quiz: [
                    {
                        question: "What's the best time to practice?",
                        options: ["Morning", "Evening", "Whenever works for you"],
                        correct: 2
                    },
                    {
                        question: "How many days to build a habit?",
                        options: ["7 days", "21 days", "90 days"],
                        correct: 1
                    }
                ]
            }
        ];

        // State
        let currentUser = null;
        let completedLessons = new Set();
        let currentLessonIndex = 0;

        // Initialize
        async function initializeApp() {
            await loadUsers();
            
            // Load saved user
            const savedUserId = localStorage.getItem('currentUserId');
            if (savedUserId) {
                document.getElementById('userSelect').value = savedUserId;
                currentUser = savedUserId;
                await loadProgress();
            } else {
                completedLessons = new Set();
                updateProgress();
            }

            renderLessonsList();
        }

        // Load users from Supabase
        async function loadUsers() {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .order('name');
            
            if (error) {
                console.error('Error loading users:', error);
                return;
            }

            const select = document.getElementById('userSelect');
            data.forEach(user => {
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = user.name;
                select.appendChild(option);
            });
        }

        // Load progress
        async function loadProgress() {
            if (!currentUser) return;

            const { data, error } = await supabase
                .from('progress')
                .select('lesson_id')
                .eq('user_id', currentUser)
                .eq('completed', true);
            
            if (error) {
                console.error('Error loading progress:', error);
                return;
            }

            completedLessons = new Set(data.map(p => p.lesson_id));
            updateProgress();
        }

        // Update progress display
        function updateProgress() {
            const total = lessons.length;
            const completed = completedLessons.size;
            const percent = Math.round((completed / total) * 100);
            
            document.getElementById('progressText').textContent = `${completed}/${total} lessons`;
            document.getElementById('progressFill').style.width = `${percent}%`;
        }

        // Render lessons list
        function renderLessonsList() {
            const container = document.getElementById('lessonsList');
            container.innerHTML = '';

            lessons.forEach((lesson, index) => {
                const isCompleted = completedLessons.has(lesson.id);
                const card = document.createElement('div');
                card.className = `lesson-card ${isCompleted ? 'completed' : ''}`;
                card.onclick = () => showLesson(index);
                
                card.innerHTML = `
                    <div class="lesson-number">${lesson.order}</div>
                    <div class="lesson-info">
                        <div class="lesson-title">${lesson.title}</div>
                        <div class="lesson-desc">${lesson.description}</div>
                        <div class="lesson-duration">${lesson.duration} minutes</div>
                    </div>
                `;
                
                container.appendChild(card);
            });
        }

        // Show lesson
        function showLesson(index) {
            if (!currentUser) {
                alert('Please select a user first');
                return;
            }

            currentLessonIndex = index;
            const lesson = lessons[index];

            document.getElementById('homeView').style.display = 'none';
            document.getElementById('lessonView').classList.add('active');

            document.getElementById('lessonTitle').textContent = lesson.title;
            document.getElementById('lessonDesc').textContent = lesson.description;
            document.getElementById('lessonMeta').textContent = `📚 Lesson ${lesson.order} · ⏱️ ${lesson.duration} min`;
            document.getElementById('lessonContent').innerHTML = lesson.content;

            // Navigation buttons
            document.getElementById('prevButton').style.visibility = index > 0 ? 'visible' : 'hidden';
            document.getElementById('nextButton').style.visibility = index < lessons.length - 1 ? 'visible' : 'hidden';

            // Render quiz
            renderQuiz(lesson);

            window.scrollTo(0, 0);
        }

        // Render quiz
        function renderQuiz(lesson) {
            const container = document.getElementById('quizContainer');
            if (!lesson.quiz || lesson.quiz.length === 0) {
                container.innerHTML = '';
                return;
            }

            let quizHTML = '<div class="quiz-section"><h3>Quiz</h3>';
            
            lesson.quiz.forEach((q, qIndex) => {
                quizHTML += `
                    <div class="quiz-question">
                        <div class="question-text">${qIndex + 1}. ${q.question}</div>
                `;
                
                q.options.forEach((option, oIndex) => {
                    quizHTML += `
                        <div class="quiz-option" onclick="selectAnswer(${qIndex}, ${oIndex})">
                            <input type="radio" name="q${qIndex}" id="q${qIndex}_${oIndex}">
                            <label for="q${qIndex}_${oIndex}">${option}</label>
                        </div>
                    `;
                });
                
                quizHTML += '</div>';
            });

            quizHTML += `
                <button class="quiz-submit" id="submitQuiz" onclick="submitQuiz()">Submit Quiz</button>
                <div id="quizResult" style="display: none;"></div>
            </div>`;

            container.innerHTML = quizHTML;
        }

        // Select answer
        function selectAnswer(questionIndex, optionIndex) {
            const radio = document.getElementById(`q${questionIndex}_${optionIndex}`);
            radio.checked = true;
        }

        // Submit quiz
        async function submitQuiz() {
            const lesson = lessons[currentLessonIndex];
            const answers = [];
            let allAnswered = true;

            // Collect answers
            lesson.quiz.forEach((q, qIndex) => {
                const selected = document.querySelector(`input[name="q${qIndex}"]:checked`);
                if (!selected) {
                    allAnswered = false;
                    return;
                }
                const optionIndex = parseInt(selected.id.split('_')[1]);
                answers.push(optionIndex);
            });

            if (!allAnswered) {
                alert('Please answer all questions');
                return;
            }

            // Calculate score
            let correct = 0;
            lesson.quiz.forEach((q, qIndex) => {
                if (answers[qIndex] === q.correct) {
                    correct++;
                }
            });

            const score = Math.round((correct / lesson.quiz.length) * 100);

            // Show results
            lesson.quiz.forEach((q, qIndex) => {
                const options = document.querySelectorAll(`input[name="q${qIndex}"]`);
                options.forEach((option, oIndex) => {
                    const parent = option.parentElement;
                    parent.style.pointerEvents = 'none';
                    
                    if (oIndex === q.correct) {
                        parent.classList.add('correct');
                    } else if (oIndex === answers[qIndex]) {
                        parent.classList.add('incorrect');
                    }
                });
            });

            // Show score
            const resultDiv = document.getElementById('quizResult');
            resultDiv.innerHTML = `Score: ${score}% (${correct}/${lesson.quiz.length} correct)`;
            resultDiv.style.display = 'block';

            // Hide submit button
            document.getElementById('submitQuiz').style.display = 'none';

            // Save progress
            await saveProgress(lesson.id, score, answers);

            // Mark as completed
            completedLessons.add(lesson.id);
            updateProgress();
            renderLessonsList();
        }

        // Save progress to Supabase
        async function saveProgress(lessonId, score, answers) {
            if (!currentUser) return;

            const { error } = await supabase
                .from('progress')
                .upsert({
                    user_id: currentUser,
                    lesson_id: lessonId,
                    completed: true,
                    quiz_score: score,
                    quiz_answers: answers,
                    updated_at: new Date().toISOString()
                });

            if (error) {
                console.error('Error saving progress:', error);
            }
        }

        // Navigate lessons
        function navigateLesson(direction) {
            const newIndex = currentLessonIndex + direction;
            if (newIndex >= 0 && newIndex < lessons.length) {
                showLesson(newIndex);
            }
        }

        // Show home
        function showHome() {
            document.getElementById('homeView').style.display = 'block';
            document.getElementById('lessonView').classList.remove('active');
            renderLessonsList(); // Refresh to show updated completion status
        }

        // User selection change
        document.getElementById('userSelect').addEventListener('change', async (e) => {
            currentUser = e.target.value;
            if (currentUser) {
                localStorage.setItem('currentUserId', currentUser);
                await loadProgress();
                renderLessonsList();
            } else {
                localStorage.removeItem('currentUserId');
                completedLessons = new Set();
                updateProgress();
                renderLessonsList();
            }
        });