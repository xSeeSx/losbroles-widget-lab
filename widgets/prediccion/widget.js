const openSocket = () => {
    let activeTimers = {
        predictionInterval: null,
        endSequenceTimeouts: [],
        scheduledExitTimeout: null,
    };

    let onShownCallback = null;

    const log = (msg) => console.log(msg);

    const cancelAllPendingActions = () => {
        log("[State] Cancelling all pending timers and intervals...");
        if (activeTimers.predictionInterval) clearInterval(activeTimers.predictionInterval);
        if (activeTimers.scheduledExitTimeout) clearTimeout(activeTimers.scheduledExitTimeout);
        activeTimers.endSequenceTimeouts.forEach(clearTimeout);

        activeTimers.predictionInterval = null;
        activeTimers.scheduledExitTimeout = null;
        activeTimers.endSequenceTimeouts = [];

        const overlay = document.querySelector('.prediction-overlay');
        if (overlay) {
            overlay.classList.remove('fadeIn', 'fadeOut');
            if (onShownCallback) {
                overlay.removeEventListener('animationend', onShownCallback);
                onShownCallback = null;
                log("[State] Removed stray animationend listener.");
            }
        }
        log("[State] All pending actions cancelled.");
    };

    // --- Utilidades de layout para mínimos de ancho (CEF-safe) ---
    // Calcula un mínimo en píxeles para cada .prediction-child basado en
    // los elementos que suelen desbordar: %, usuarios y multiplicador.
    const computeMinWidthPx = (el) => {
        // margen/padding de seguridad para que no roce el borde romboidal
        const PADDING_SAFE = 24;
        const pct = el.querySelector('.progress-bar-percent-text');
        const mult = el.querySelector('.progress-bar-multiplier');
        const users = el.querySelector('.progress-bar-users');

        const wPct   = pct   ? pct.offsetWidth   : 0;
        const wMult  = mult  ? mult.offsetWidth  : 0;
        const wUsers = users ? users.offsetWidth : 0;

        // Nos quedamos con el mayor de los tres; el título no lo usamos para fijar mínimo
        // porque puede ser largo y ya está resuelto en tu overlay (truncado/flujo propio).
        const need = Math.max(wPct, wMult, wUsers) + PADDING_SAFE;

        // Fallback defensivo por si algo aún no está pintado
        return need > 0 ? need : 80; // 80px como mínimo duro muy conservador
    };

    // Ajusta anchuras respetando mínimos en px y el % real. Si no cabe todo,
    // comprime proporcionalmente sin bajar de los mínimos.
    const applyWidthsWithMin = (container, items, percents) => {
        const parentW = container.getBoundingClientRect().width || 960; // fallback
        // 1) Convertir % a px
        const pxIdeal = percents.map(p => (p / 100) * parentW);

        // 2) Mínimos por item (cacheados en dataset para evitar medir cada tick)
        const minPx = items.map((el) => {
            let val = el.dataset.minWidthPx ? parseFloat(el.dataset.minWidthPx) : 0;
            if (!val || Number.isNaN(val)) {
                val = computeMinWidthPx(el);
                el.dataset.minWidthPx = String(val);
            }
            return val;
        });

        // 3) Elevar cada barra a su mínimo (solo tiene sentido cuando hay votos > 0)
        let pxFinal = pxIdeal.map((px, i) => Math.max(px, minPx[i]));

        // 4) Si nos pasamos del ancho total, comprimimos sin bajar mínimos
        const sum = pxFinal.reduce((a, b) => a + b, 0);
        if (sum > parentW) {
            let over = sum - parentW;
            // Capacidad de compresión por encima de mínimos
            let capacity = pxFinal.reduce((acc, px, i) => acc + Math.max(px - minPx[i], 0), 0);

            if (capacity > 0) {
                // Reducir proporcionalmente al "exceso sobre mínimo"
                pxFinal = pxFinal.map((px, i) => {
                    const extra = Math.max(px - minPx[i], 0);
                    const take = over * (extra / capacity);
                    const newPx = px - take;
                    return newPx < minPx[i] ? minPx[i] : newPx;
                });
            } else {
                // Caso extremo: todos están ya en su mínimo. Repartimos recorte equitativo
                // pero nunca bajamos de minPx (si aún así no cabe, aceptamos último píxel de desfase).
                const n = pxFinal.length;
                const slice = over / n;
                pxFinal = pxFinal.map((px, i) => Math.max(px - slice, minPx[i]));
            }
        }

        // 5) Aplicar anchuras en %
        pxFinal.forEach((px, i) => {
            const wPercent = (px / parentW) * 100;
            items[i].style.width = `${wPercent}%`;
        });
    };

    let i = 0;

    log("[Init] Connecting to WebSocket…");
    const sock = new WebSocket("wss://losbroles.lessergio.workers.dev/ws?broadcaster_id=133649243");

    sock.addEventListener("open", () => log("[WS] Connected!"));

    sock.addEventListener("message", (e) => {
        const msg = JSON.parse(e.data);
        const type = msg.subscription?.type || msg.type;
        log(`[WS] Message received: ${type}`);

        if (msg.type === "welcome") {
            sock.send(JSON.stringify({
                session_id: msg.session_id, type: "welcome", user_id: "133649243",
                scope: "channel:read:predictions", user_agent: navigator.userAgent,
            }));
            log("[WS] Sent handshake with user_id 133649243");
        }

        if (type === "channel.prediction.begin") {
            log("[BEGIN] New prediction starting. Resetting state.");
            cancelAllPendingActions();
            i = 0;

            const overlay = document.querySelector(".prediction-overlay");
            const container = document.querySelector(".prediction-children");
            const title = document.querySelector(".prediction-title-text");

            container.innerHTML = "";
            window._polyClones = [];
            overlay.style.display = "inherit";
            container.classList.remove('slideOut');

            void overlay.offsetWidth;
            overlay.classList.add("fadeIn");
            title.innerHTML = `${msg.event.title}`;

            const outcomes = msg.event?.outcomes || [];
            const locks = new Date(msg.event.locks_at).getTime();
            let duracion = Math.floor((locks - Date.now()) / 1000);
            const reloj = document.querySelector(".prediction-time-text");

            if (reloj && !isNaN(duracion)) {
                reloj.style.transition = 'none';
                reloj.style.opacity = "1";
                const actualizarReloj = (s) => {
                    reloj.textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
                };
                actualizarReloj(duracion);
                activeTimers.predictionInterval = setInterval(() => {
                    duracion--;
                    if (duracion <= 0) {
                        clearInterval(activeTimers.predictionInterval);
                        reloj.textContent = "00:00";
                    } else {
                        actualizarReloj(duracion);
                    }
                }, 1000);
            }

            for (const outcome of outcomes) {
                const currentIndex = i++;
                const percInit = 100 / outcomes.length;

                const div = document.createElement("div");
                div.className = `prediction-child ${outcome.id}`;
                div.dataset.outcomeId = outcome.id;

                // Ancho inicial como antes; el mínimo se aplicará en 'progress'
                div.style.width = `${((960 - (outcomes.length - 1) * 25) / outcomes.length / 960) * 100}%`;
                div.style.maxWidth = "100%";
                div.style.opacity = "0";

                const background = ["#ffbb00", "#0f63ff", "#ff0000"];
                // Mantengo tu estructura original (sin tocar clonación ni layout base)
                div.innerHTML =
                    `<div class="progress-bar-stats"><div class="progress-bar-stats-child"><div class="progress-bar-text">${outcome.title || "Sin título"}</div></div></div>
                     <div class="progress-bar">
                        <div class="prediction-outcome progress-bar-foreground-1"
                             style="background-color: ${background[currentIndex % 3]};
                                    clip-path: polygon(15px 0%, 100% 0%, calc(100% - 15px) 100%, 0% 100%);">
                             <div style="position: absolute; top: 0; left: -10px; width: 110%; height: 110%;
                                         clip-path: polygon(15px 0%, 100% 0%, calc(100% - 15px) 100%, 0% 100%);
                                         background: linear-gradient(to top left, rgba(0, 0, 0, 0.5), transparent); z-index: 0;"></div>
                        </div>
                        <div class="progress-bar-percent-text">${Math.round(percInit)}%</div>
                     </div>
                     <div class="progress-bar-multiplier"><i class="fa-regular fa-star"></i> <span class="multiplier-text">x1.0</span></div>
                     <div class="progress-bar-users"><span class="progress-bar-users-text"><i class="fa-regular fa-user"></i> ${(outcome.users || 0).toLocaleString("en-US")}</span></div>`;

                // Insertar en DOM antes de medir nada (CEF necesita que esté pintado)
                container.appendChild(div);

                // Pre-calcular y cachear su mínimo en px (para el primer 'progress')
                // Esperamos un frame para que offsetWidth/Height sean fiables.
                setTimeout(() => {
                    const minPx = computeMinWidthPx(div);
                    div.dataset.minWidthPx = String(minPx);
                }, 0);

                // Animación de entrada como tenías
                setTimeout(() => requestAnimationFrame(() => {
                    void div.offsetWidth;
                    div.classList.add("slideIn");
                }), (currentIndex + 1) * 150);
            }
        }

        if (type === "channel.prediction.progress") {
            const container = document.querySelector('.prediction-children');
            const outcomes = msg.event.outcomes || [];
            const totalPoints = outcomes.reduce((acc, o) => acc + (o.channel_points || 0), 0);

            // Recogemos los nodos en el mismo orden que los outcomes
            const els = outcomes.map(o => document.querySelector(`.prediction-child.${CSS.escape(o.id)}`)).filter(Boolean);
            if (!els.length) return;

            // Porcentaje ideal por outcome (como antes)
            const percents = outcomes.map(o => {
                if (outcomes.length === 1) return 100;
                if (totalPoints <= 0) return 100 / outcomes.length; // aún sin votos
                return (o.channel_points / totalPoints) * 100;
            });

            // Si hay votos, aplicamos mínimos de px robustos
            if (totalPoints > 0) {
                applyWidthsWithMin(container, els, percents);
            } else {
                // Sin votos todavía: layout equitativo como antes
                els.forEach((el, idx) => {
                    el.style.width = `${percents[idx]}%`;
                });
            }

            // Actualizaciones de textos (sin cambios)
            outcomes.forEach((outcome, idx) => {
                const el = els[idx];
                if (!el) return;

                const percent = Math.round(percents[idx]);
                const users = outcome.users || 0;

                const pctNode = el.querySelector(".progress-bar-percent-text");
                if (pctNode) pctNode.textContent = `${percent}%`;

                const usersNode = el.querySelector(".progress-bar-users-text");
                if (usersNode) usersNode.innerHTML = `<i class="fa-regular fa-user"></i> ${users.toLocaleString("en-US")}`;

                const multNode = el.querySelector(".multiplier-text");
                if (multNode) {
                    const m = (outcome.channel_points > 0 && totalPoints > 0) ? (totalPoints / outcome.channel_points) : 1.0;
                    multNode.textContent = `x${m.toFixed(1)}`;
                }
            });
        }

        if (type === "channel.prediction.lock") {
            log("[LOCK] Prediction locked. Cloning bars.");
            const title = document.querySelector(".prediction-title-text");
            title.innerHTML = `🛑 ${msg.event.title} 🛑`;
            const reloj = document.querySelector(".prediction-time-text");
            if (reloj) {
                reloj.style.transition = 'opacity 0.3s ease';
                reloj.style.opacity = '0';
            }
            if (activeTimers.predictionInterval) clearInterval(activeTimers.predictionInterval);

            const parent = document.querySelector('.prediction-children');
            const pRect = parent.getBoundingClientRect();
            const outcomes = msg.event.outcomes || [];
            window._polyClones = outcomes.map(o => {
                const orig = parent.querySelector(`.prediction-child[data-outcome-id="${o.id}"]`);
                if (!orig) return null;
                const r = orig.getBoundingClientRect();
                const clone = orig.cloneNode(true);
                clone.dataset.outcomeId = o.id;
                clone.classList.add('poly-child');
                return { id: o.id, clone, left: r.left - pRect.left, width: r.width };
            }).filter(Boolean);

            parent.innerHTML = '';
            window._polyClones.forEach(({ clone, left, width }) => {
                clone.removeAttribute('style');
                clone.classList.remove('slideIn');
                Object.assign(clone.style, { position: 'absolute', top: '0px', left: `${left}px`, width: `${width}px`, height: '100%' });
                parent.appendChild(clone);
            });

            log("[LOCK] Scheduling widget exit in 15 seconds.");
            activeTimers.scheduledExitTimeout = setTimeout(() => {
                log("[LOCK] Executing scheduled exit.");
                const overlay = document.querySelector('.prediction-overlay');

                // FIX ROBUSTEZ (OBS): Forzar reflow para garantizar la animación de salida.
                overlay.classList.remove('fadeIn');
                void overlay.offsetWidth;
                overlay.classList.add('fadeOut');
            }, 15000);
        }

        if (type === "channel.prediction.end") {
            log("[END] Prediction ended. Starting final animations.");

            // 1) Cancelar salida programada desde LOCK y cualquier cola anterior de END
            if (activeTimers.scheduledExitTimeout) {
                clearTimeout(activeTimers.scheduledExitTimeout);
                activeTimers.scheduledExitTimeout = null;
                log("[END] Cancelled scheduled exit from LOCK.");
            }
            if (activeTimers.endSequenceTimeouts.length) {
                activeTimers.endSequenceTimeouts.forEach(clearTimeout);
                activeTimers.endSequenceTimeouts = [];
                log("[END] Cleared stale end-sequence timeouts.");
            }

            const overlay = document.querySelector('.prediction-overlay');
            const title = document.querySelector('.prediction-title-text');
            title.innerHTML = `🏆 ${msg.event.title} 🏆`;

            // 2) FORZAR reinicio de la animación de entrada (robusto en CEF)
            overlay.classList.remove('fadeOut', 'fadeIn');
            void overlay.offsetWidth; // reflow duro
            overlay.classList.add('fadeIn');

            // 3) Secuencia final (sin cambios funcionales)
            const runEndSequence = () => {
                const parent = document.querySelector('.prediction-children');
                const pRect = parent.getBoundingClientRect();
                const winningId = msg.event.winning_outcome_id;
                const clonesInfo = window._polyClones || [];

                const fadeLosersTimeout = setTimeout(() => {
                    log("[END] Fading out losing bars.");
                    clonesInfo.forEach(({ id, clone }) => {
                        if (id !== winningId) {
                            clone.style.transition = 'opacity 0.8s ease';
                            clone.style.opacity = '0';
                        }
                    });
                }, 3000);

                const expandWinnerTimeout = setTimeout(() => {
                    log("[END] Expanding winning bar.");
                    const winClone = parent.querySelector(`.poly-child[data-outcome-id="${winningId}"]`);
                    if (!winClone) return;
                    winClone.style.transition = 'left 1s ease, width 1s ease';
                    requestAnimationFrame(() => {
                        winClone.style.left = '0px';
                        winClone.style.width = `${pRect.width}px`;
                    });
                }, 5000);

                const hideAllTimeout = setTimeout(() => {
                    log("[END] Fading out the entire widget.");
                    const childrenContainer = document.querySelector('.prediction-children');

                    // Reflow para garantizar la animación de salida final (OBS/CEF)
                    overlay.classList.remove('fadeIn');
                    void overlay.offsetWidth;
                    overlay.classList.add('fadeOut');

                    if (childrenContainer) {
                        childrenContainer.classList.add('slideOut');
                    }
                }, 10000);

                activeTimers.endSequenceTimeouts.push(fadeLosersTimeout, expandWinnerTimeout, hideAllTimeout);
            };

            if (onShownCallback) {
                overlay.removeEventListener('animationend', onShownCallback);
                onShownCallback = null;
            }

            let fired = false;
            onShownCallback = (event) => {
                if (event.target !== overlay) return;
                overlay.removeEventListener('animationend', onShownCallback);
                onShownCallback = null;
                if (fired) return;
                fired = true;
                runEndSequence();
            };
            overlay.addEventListener('animationend', onShownCallback);

            // Fallback por si CEF no emite animationend
            setTimeout(() => {
                if (!fired) {
                    log("[END] Fallback triggered (no animationend). Running end sequence.");
                    overlay.removeEventListener('animationend', onShownCallback);
                    onShownCallback = null;
                    fired = true;
                    runEndSequence();
                }
            }, 500);
        }

    });

    sock.addEventListener("error", (e) => log("[WS] ERROR!", console.error(e)));
    sock.addEventListener("close", () => {
        log("[WS] Connection closed. Retrying in 5s…");
        cancelAllPendingActions();
        setTimeout(openSocket, 5000);
    });
};

openSocket();
