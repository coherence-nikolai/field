// ═══════════════════════════════════════
// FIELD — Unified Data v1.0
// Three movements: Observe · Collapse · Decohere
// ═══════════════════════════════════════

const TRANSLATIONS = {
  en: {
    // Welcome intro (first launch only)
    welcomeCard0Big: 'You exist in\n<b>superposition.</b>',
    welcomeCard0Small: 'Every version of you is real right now.\nCalm. Brave. Clear. Stuck. Afraid.\nAll equally present. None more true than another.',
    welcomeCard1Big: 'The state you <b>observe</b>\nbecomes the state you inhabit.',
    welcomeCard1Small: 'This is not metaphor.\nIt is the physics of attention.\nWhat you measure, you create.',
    welcomeCard2Big: 'Three practices.\nOne field.',
    wlcMvLabels: ['Observe','Collapse','Decohere'],
    wlcMvHints: ['train attention','choose a state','release what you carry'],
    wlcEnterBtn: 'enter the field',
    wlcTapHint: 'tap to continue',
    // Field arrival
    fieldArrival: 'The field is open.',
    fieldSub: 'Choose your practice.',
    observeLabel: 'Observe',
    collapseLabel: 'Collapse',
    decohere_label: 'Decohere',
    observeHint: 'train attention',
    collapseHint: 'choose a state',
    decohereHint: 'release what you carry',

    // Collapse
    fieldLine: 'These versions of you exist right now.',
    cLabel: 'You just collapsed upward ↑',
    cSub: 'The observer has spoken. The field has responded.',
    ceqNote: 'your observation just made this real',
    imagLabel: 'before you breathe — find it in yourself',
    qlabel: 'carry this into the next hour',
    retBtn: 'return to field',
    stillTxt: 'The field is full.\nPresence is enough.',
    tapHint: 'tap to continue',
    readyBtn: 'I am ready to observe',
    obsCount: n => n > 0 ? `You have consciously observed ${n} time${n!==1?'s':''}` : '',
    obsFirst: s => `You have observed <strong>${s}</strong> for the first time.\nThe wave function just found a new direction.`,
    obsMany: (s,n) => `You have observed <strong>${s}</strong> ${n} times.\nThis collapse is becoming familiar.\nAt some point — it will simply be you.`,
    breathInhale: 'inhale',
    breathHold: 'hold',
    breathEnd: s => `Your nervous system now knows the direction.\n<strong>${s}</strong> is encoded in you.\nKeep observing.`,

    // Observer
    obsArrivalSub: 'One particle.\nNo instructions.\nJust watch.',
    obsHint: 'tap to begin',
    obsScatter: 'the field reforms — begin again',
    obsCoherenceWord: 'S T I L L N E S S',
    obsCoherenceLine: 'The field responded.\nThis is what collapse feels like\nbefore you choose a state.',
    obsCoherenceTap: 'tap to continue',
    obsStillWord: 'Still',
    obsStillSub: 'You held it.\nThe particle knows.',
    obsStillTap: 'tap to return to field',
    obsTrainHint: 'Train the attention that makes collapse possible.\nEvery tap scatters. Every second clarifies.',

    // Decohere
    decArrivalLine: 'What are you carrying right now?',
    decArrivalSub: 'Choose what wants to be released.',
    decInhale: 'inhale · and once more',
    decExhale: 'exhale slowly',
    decEndLine: 'The field is clear.',
    decEndSub: 'What was heavy is back in superposition.\nReady to collapse into something new.',
    decRetBtn: 'return to field',
    decAgainBtn: 'release another',
  },
  es: {
    // Welcome intro (first launch only)
    welcomeCard0Big: 'Existes en\n<b>superposición.</b>',
    welcomeCard0Small: 'Cada versión tuya es real ahora mismo.\nSereno. Valiente. Claro. Bloqueado. Asustado.\nTodas igualmente presentes. Ninguna más verdadera que otra.',
    welcomeCard1Big: 'El estado que <b>observas</b>\nes el estado que habitas.',
    welcomeCard1Small: 'Esto no es metáfora.\nEs la física de la atención.\nLo que mides, lo creas.',
    welcomeCard2Big: 'Tres prácticas.\nUn campo.',
    wlcMvLabels: ['Observar','Colapsar','Disipar'],
    wlcMvHints: ['entrenar la atención','elegir un estado','soltar lo que cargas'],
    wlcEnterBtn: 'entrar al campo',
    wlcTapHint: 'toca para continuar',
    // Field arrival
    fieldArrival: 'El campo está abierto.',
    fieldSub: 'Elige tu práctica.',
    observeLabel: 'Observar',
    collapseLabel: 'Colapsar',
    decohere_label: 'Disipar',
    observeHint: 'entrenar la atención',
    collapseHint: 'elegir un estado',
    decohereHint: 'soltar lo que cargas',

    // Collapse
    fieldLine: 'Estas versiones tuyas existen ahora mismo.',
    cLabel: 'Acabas de colapsar hacia arriba ↑',
    cSub: 'El observador ha hablado. El campo ha respondido.',
    ceqNote: 'tu observación acaba de hacer esto real',
    imagLabel: 'antes de respirar — encuéntralo en ti',
    qlabel: 'lleva esto a la próxima hora',
    retBtn: 'volver al campo',
    stillTxt: 'El campo está lleno.\nLa presencia es suficiente.',
    tapHint: 'toca para continuar',
    readyBtn: 'Estoy listo para observar',
    obsCount: n => n > 0 ? `Has observado conscientemente ${n} vez${n!==1?'es':''}` : '',
    obsFirst: s => `Has observado <strong>${s}</strong> por primera vez.\nLa función de onda encontró una nueva dirección.`,
    obsMany: (s,n) => `Has observado <strong>${s}</strong> ${n} veces.\nEste colapso se está volviendo familiar.\nEn algún momento — simplemente serás tú.`,
    breathInhale: 'inhala',
    breathHold: 'sostén',
    breathEnd: s => `Tu sistema nervioso ahora conoce la dirección.\n<strong>${s}</strong> está codificado en ti.\nSigue observando.`,

    // Observer
    obsArrivalSub: 'Una partícula.\nSin instrucciones.\nSolo observa.',
    obsHint: 'toca para comenzar',
    obsScatter: 'el campo se reforma — comienza de nuevo',
    obsCoherenceWord: 'Q U I E T U D',
    obsCoherenceLine: 'El campo respondió.\nAsí se siente el colapso\nantes de elegir un estado.',
    obsCoherenceTap: 'toca para continuar',
    obsStillWord: 'Quieto',
    obsStillSub: 'Lo sostuviste.\nLa partícula lo sabe.',
    obsStillTap: 'toca para volver al campo',
    obsTrainHint: 'Entrena la atención que hace posible el colapso.\nCada toque dispersa. Cada segundo clarifica.',

    // Decohere
    decArrivalLine: '¿Qué estás cargando ahora mismo?',
    decArrivalSub: 'Elige lo que quiere ser liberado.',
    decInhale: 'inhala · y una vez más',
    decExhale: 'exhala despacio',
    decEndLine: 'El campo está despejado.',
    decEndSub: 'Lo que era pesado está de vuelta en superposición.\nListo para colapsar en algo nuevo.',
    decRetBtn: 'volver al campo',
    decAgainBtn: 'liberar otro',
  }
};

const STATES = {
  en: [
    { name:'Calm',      question:"Where can this steadiness move through you in the next hour?",        eq:'|ψ⟩ → |calm⟩ — stillness selected from infinite noise' },
    { name:'Brave',     question:"What does this version of you want to step toward right now?",         eq:'|ψ⟩ → |brave⟩ — courage collapsed from pure potential' },
    { name:'Clear',     question:"What becomes obvious when you trust this clarity?",                    eq:'|ψ⟩ → |clear⟩ — signal sharpened from superposed fog' },
    { name:'Expansive', question:"What expands when you stop measuring yourself as small?",              eq:'|ψ⟩ → |expansive⟩ — the field opening beyond its edges' },
    { name:'Grounded',  question:"What becomes possible when you are this rooted?",                      eq:'|ψ⟩ → |grounded⟩ — presence collapsed into this exact moment' },
    { name:'Present',   question:"What is actually here, right now, that you haven't fully seen?",      eq:'|ψ⟩ → |present⟩ — all future states begin with this observation' },
    { name:'Luminous',  question:"Where does this light want to land in your next conversation?",        eq:'|ψ⟩ → |luminous⟩ — the highest available collapse selected' },
    { name:'Open',      question:"What has been waiting for you to stop resisting it?",                  eq:'|ψ⟩ → |open⟩ — resistance dissolved, field restored' }
  ],
  es: [
    { name:'Sereno',    question:"¿Dónde puede fluir esta tranquilidad a través de ti en la próxima hora?", eq:'|ψ⟩ → |sereno⟩ — quietud seleccionada del ruido infinito' },
    { name:'Valiente',  question:"¿Hacia qué quiere avanzar esta versión tuya ahora mismo?",                eq:'|ψ⟩ → |valiente⟩ — fuerza colapsada desde puro potencial' },
    { name:'Claro',     question:"¿Qué se vuelve obvio cuando confías en esta claridad?",                   eq:'|ψ⟩ → |claro⟩ — señal afilada desde la niebla superpuesta' },
    { name:'Expansivo', question:"¿Qué se expande cuando dejas de medirte como pequeño?",                   eq:'|ψ⟩ → |expansivo⟩ — el campo abriéndose más allá de sus bordes' },
    { name:'Arraigado', question:"¿Qué se vuelve posible cuando estás tan enraizado?",                      eq:'|ψ⟩ → |arraigado⟩ — presencia colapsada en este momento exacto' },
    { name:'Presente',  question:"¿Qué hay aquí, ahora mismo, que aún no has visto del todo?",              eq:'|ψ⟩ → |presente⟩ — todos los estados futuros comienzan con esta observación' },
    { name:'Luminoso',  question:"¿Dónde quiere aterrizar esta luz en tu próxima conversación?",             eq:'|ψ⟩ → |luminoso⟩ — el colapso más alto disponible seleccionado' },
    { name:'Abierto',   question:"¿Qué ha estado esperando que dejes de resistirlo?",                       eq:'|ψ⟩ → |abierto⟩ — resistencia disuelta, campo restaurado' }
  ]
};

const SHADOW_STATES = {
  en: ['Anxious','Heavy','Stuck','Numb','Scattered','Angry','Tired','Overwhelmed','Disconnected','Afraid'],
  es: ['Angustiado','Agobiado','Bloqueado','Apagado','Disperso','Enojado','Agotado','Sobrepasado','Desconectado','Asustado']
};

const STEPS = {
  en: [
    { big:'These are particles.\nRight now they have no definite state.', small:'Watch them. Blurry. Drifting. Undefined.\nEverywhere at once.', ps:'sp' },
    { big:'This is called <b>superposition.</b>', small:'Every possible state exists simultaneously.\nNone more real than another.\nUntil one is measured.', ps:'sp' },
    { big:'One particle is being <b>observed.</b>\nIt has snapped into reality.', small:'Everything else fades.\nThe field collapses to a single point.', ps:'one' },
    { big:'Every version of you\nexists right now.', small:'Calm. Brave. Clear. Present.\nAll equally real. All waiting.', ps:'all_labelled' },
    { big:'Observation does not reveal\nwhat is there.\nIt <b>creates</b> what is there.', ps:'flicker' },
    { big:'This is <b>collapse.</b>', small:'Not loss. Not failure.\nThe moment infinite becomes real.\nYou chose one. It became this.', ps:'collapse_demo' },
    { big:'Your nervous system\nfollows the same physics.', small:'Observed as <b>anxious</b> for a lifetime — it solidifies.\nThe other versions never disappeared.\nThey were simply unmeasured.', ps:'stab' },
    { big:'The first time you observe courage —\nit flickers.\nThe hundredth time —\nit is simply <b>who you are.</b>', note:'<span>Verified:</span> Neuroplasticity confirms repeated observation patterns rebuild neural architecture.', ps:'crystallise' },
    { big:'You are about to run\nthis experiment on yourself.', small:'<b>Consciously.</b>', ps:'done', isLast:true }
  ],
  es: [
    { big:'Estas son partículas.\nAhora mismo no tienen un estado definido.', small:'Obsérvales. Borrosas. Derivando. Indefinidas.\nEn todas partes a la vez.', ps:'sp' },
    { big:'Esto se llama <b>superposición.</b>', small:'Todos los estados posibles existen simultáneamente.\nNinguno más real que otro.\nHasta que uno es medido.', ps:'sp' },
    { big:'Una partícula está siendo <b>observada.</b>\nYa se ha cristalizado en la realidad.', small:'Todo lo demás se desvanece.\nEl campo colapsa a un solo punto.', ps:'one' },
    { big:'Cada versión de ti\nexiste ahora mismo.', small:'Sereno. Valiente. Claro. Presente.\nTodos igualmente reales. Todos esperando.', ps:'all_labelled' },
    { big:'La observación no revela\nlo que está ahí.\nLo <b>crea.</b>', ps:'flicker' },
    { big:'Esto es el <b>colapso.</b>', small:'No es pérdida. No es fallo.\nEl momento en que lo infinito se vuelve real.\nElegiste uno. Se convirtió en esto.', ps:'collapse_demo' },
    { big:'Tu sistema nervioso\nsigue la misma física.', small:'Observado como <b>ansioso</b> toda una vida — se solidifica.\nLas otras versiones nunca desaparecieron.\nSimplemente no fueron medidas.', ps:'stab' },
    { big:'La primera vez que observas valentía —\ntitila.\nLa centésima vez —\nsimplemente es <b>quien eres.</b>', note:'<span>Verificado:</span> La neuroplasticidad confirma que los patrones de observación repetida reconstruyen la arquitectura neural.', ps:'crystallise' },
    { big:'Estás a punto de ejecutar\neste experimento en ti mismo.', small:'<b>Conscientemente.</b>', ps:'done', isLast:true }
  ]
};

const IMAGINATION = {
  en: {
    Calm:['Remember a moment the world went quiet around you. Find that silence again now.','Imagine still water. Not moving. Just reflecting. Let your mind become that.','Think of the most unhurried you have ever felt. What did your breathing sound like there?','Visualise a colour that feels peaceful to you. Let it fill the space behind your eyes.','Feel the weight of your hands right now. Let that weight spread slowly through your whole body.'],
    Brave:['Remember a moment you moved toward something that frightened you. Feel where that lived in your body.','Think of a time you spoke the truth when silence would have been easier.','Visualise yourself walking through a door you have been standing outside of. Feel your hand on the handle.','Remember someone who believed in you before you believed in yourself. Stand in their seeing of you.','Imagine your fear as weather — passing through, not permanent. Feel what remains underneath it.'],
    Clear:['Think of a moment everything suddenly made sense. Notice how your mind felt in that instant.','Imagine fog slowly lifting from a landscape you know well. Watch what becomes visible.','Remember a decision you made that felt completely right. Not logical — right. Find that knowing.','Visualise your thoughts as clouds moving through a wide open sky. The sky itself is always clear.','Think of a moment you gave someone else perfect advice. That clarity belongs to you too.'],
    Expansive:['Visualise yourself from above — no walls, no ceiling, no edges. Let the feeling of that arrive.','Remember a moment you felt genuinely free. Not free from something — free.','Imagine your awareness extending outward in every direction simultaneously. No boundary. Just open field.','Visualise the night sky on a clear night far from any city. You are not separate from that. You are made of it.','Think of a version of your life where the ceiling you have accepted simply does not exist.'],
    Grounded:['Feel the weight of your body right now. Imagine roots moving downward from where you sit.','Remember a moment you felt completely solid in yourself. Nothing could move you. Find that ground.','Visualise a mountain. Not climbing it — being it. Immovable. Present. Untroubled by weather.','Feel your feet. Really feel them. The pressure of the floor. This is the present moment.','Remember a time you stayed steady while everything around you was uncertain.'],
    Present:['Look at one thing near you as if you have never seen it before. Really look.','Notice three sounds you can hear right now that you were not noticing a moment ago.','Feel the temperature of the air on your skin. This sensation is only available right now.','Think of this exact moment as the only moment that has ever existed.','Think of this breath as the most important thing happening on earth right now. Because for you, it is.'],
    Luminous:['Remember a moment your presence made someone\'s face light up. Stay with that warmth.','Visualise light emanating from the centre of your chest. Not performed. Just existing.','Remember a moment you felt genuinely, completely yourself — and it was enough. More than enough.','Think of someone whose mere presence makes everything better. You have been that for someone.','Imagine that the quality of your inner state is already lifting everyone near you. It is.'],
    Open:['Think of something you have been holding tightly. Imagine your hands releasing it.','Remember a moment a completely unexpected idea or person changed your direction for the better.','Visualise a door you have kept closed. You do not have to walk through it yet. Just imagine it unlocked.','Remember a time you said yes to something uncertain and it became one of the best things that happened.','Imagine your resistance as a physical tension. Now imagine that tension dissolving slowly, without force.']
  },
  es: {
    Sereno:['Recuerda un momento en que el mundo a tu alrededor se quedó en silencio.','Imagina agua quieta. Sin movimiento. Solo reflejando.','Siente el peso de tus manos ahora mismo. Deja que ese peso se extienda lentamente.','Visualiza un color que te transmita paz. Deja que llene el espacio detrás de tus ojos.','Recuerda estar en algún lugar de la naturaleza donde nada requería tu atención.'],
    Valiente:['Recuerda un momento en que avanzaste hacia algo que te daba miedo.','Piensa en una vez que dijiste la verdad cuando el silencio hubiera sido más fácil.','Visualízate cruzando una puerta frente a la que has estado parado.','Recuerda a alguien que creyó en ti antes de que tú creyeras en ti mismo.','Imagina tu miedo como el clima — pasajero, no permanente.'],
    Claro:['Piensa en un momento en que todo de repente tuvo sentido.','Imagina una neblina levantándose lentamente de un paisaje que conoces bien.','Recuerda una decisión que se sintió completamente correcta. No lógica — correcta.','Visualiza tus pensamientos como nubes. El cielo en sí siempre está despejado.','Piensa en lo que ya sabes pero has estado fingiendo no saber.'],
    Expansivo:['Visualízate desde arriba — sin muros, sin techo, sin bordes.','Recuerda un momento en que te sentiste genuinamente libre.','Imagina tu conciencia expandiéndose en todas las direcciones a la vez.','Visualiza el cielo nocturno lejos de la ciudad. Estás hecho de ello.','Piensa en una versión de tu vida donde el techo que has aceptado no existe.'],
    Arraigado:['Siente el peso de tu cuerpo ahora mismo. Imagina raíces moviéndose hacia abajo.','Recuerda un momento en que te sentiste completamente sólido en ti mismo.','Visualiza una montaña. No escalándola — siendo ella.','Siente tus pies. De verdad siéntelos. La presión del suelo.','Recuerda una vez en que te mantuviste firme mientras todo a tu alrededor era incierto.'],
    Presente:['Mira algo cercano como si nunca lo hubieras visto antes.','Nota tres sonidos que puedes escuchar ahora mismo.','Siente la temperatura del aire en tu piel.','Piensa en este momento exacto como el único momento que ha existido jamás.','Piensa en esta respiración como lo más importante que está pasando ahora mismo.'],
    Luminoso:['Recuerda un momento en que tu presencia hizo que el rostro de alguien se iluminara.','Visualiza luz emanando desde el centro de tu pecho.','Recuerda un momento en que te sentiste genuina y completamente tú mismo.','Piensa en alguien cuya sola presencia hace que todo mejore. Tú has sido eso para alguien.','Imagina que la calidad de tu estado interior ya está elevando a todos los que tienes cerca.'],
    Abierto:['Piensa en algo que has estado sosteniendo con fuerza. Imagina tus manos soltándolo.','Recuerda un momento en que algo inesperado cambió tu rumbo para mejor.','Visualiza una puerta que has mantenido cerrada. Solo imagínala desbloqueada.','Recuerda una vez que le dijiste sí a algo incierto y fue una de las mejores cosas.','Imagina tu resistencia como una tensión física que se disuelve lentamente.']
  }
};

function getImagination(lang, stateName) {
  const pool = IMAGINATION[lang][stateName];
  if (!pool) return '';
  return pool[Math.floor(Math.random() * pool.length)];
}

const WITNESSED = {
  en: {
    Anxious:      "You were never meant to hold all of it.",
    Heavy:        "It was real. It doesn't have to stay.",
    Stuck:        "The field always had more directions than one.",
    Numb:         "Feeling less was how you survived. You can feel more now.",
    Scattered:    "Every part of you was trying. That was enough.",
    Angry:        "The anger knew something. Now the field holds it.",
    Tired:        "Rest is not failure. It is the field restoring itself.",
    Overwhelmed:  "You carried more than anyone should. It's back in the field now.",
    Disconnected: "You were never actually separate. Only unobserved.",
    Afraid:       "The field held you through it."
  },
  es: {
    Angustiado:   "Nunca tuviste que cargar con todo eso.",
    Agobiado:     "Era real. No tiene que quedarse.",
    Bloqueado:    "El campo siempre tuvo más direcciones que una.",
    Apagado:      "Sentir menos era como sobrevivías. Ahora puedes sentir más.",
    Disperso:     "Cada parte de ti lo intentaba. Eso fue suficiente.",
    Enojado:      "La ira sabía algo. Ahora el campo lo sostiene.",
    Agotado:      "El descanso no es fracaso. Es el campo restaurándose.",
    Sobrepasado:  "Cargaste más de lo que nadie debería. Está de vuelta en el campo.",
    Desconectado: "Nunca estuviste realmente separado. Solo no observado.",
    Asustado:     "El campo te sostuvo durante todo."
  }
};
