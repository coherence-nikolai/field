// ═══════════════════════════════════════
// FIELD — Unified Data v1.1
// Three movements: Observe · Collapse · Decohere
// ═══════════════════════════════════════

const TRANSLATIONS = {
  en: {
    welcomeCard0Big: 'You exist in\n<b>superposition.</b>',
    welcomeCard0Small: 'Every version of you is real right now.\nCalm. Brave. Clear. Stuck. Afraid.\nAll equally present. None more true than another.',
    welcomeCard1Big: 'The state you <b>observe</b>\nbecomes the state you inhabit.',
    welcomeCard1Small: 'This is not metaphor.\nIt is the physics of attention.\nWhat you measure, you create.',
    welcomeCard2Big: 'Four movements.\nOne field.',
    wlcMvLabels: ['Observe','Witness','Collapse','Still'],
    wlcMvHints: ['train attention','meet what is here','choose a state','land in it'],
    wlcEnterBtn: 'enter the field',
    wlcTapHint: 'tap to continue',
    fieldArrival: 'The field is open.',
    fieldSub: 'attention shapes the field',
    observeLabel: 'Observe',
    collapseLabel: 'Collapse',
    decohere_label: 'Witness',
    stillLabel: 'Still',
    observeHint: 'train attention',
    collapseHint: 'choose a state',
    decohereHint: 'meet what is here',
    stillHint: 'land in it',
    fieldLine: 'These versions of you exist right now.',
    cLabel: 'you collapsed into',
    cSub: 'the field holds this now',
    ceqNote: '',
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
    decArrivalLine: 'What is asking to be seen?',
    decArrivalSub: 'Name what is present.',
    decInhale: 'inhale · and once more',
    decExhale: 'exhale slowly',
    decEndLine: 'It was seen.',
    decEndSub: 'What was heavy is back in superposition.\nReady to collapse into something new.',
    decRetBtn: 'return to field',
    decAgainBtn: 'witness another',
  },
  es: {
    welcomeCard0Big: 'Existes en\n<b>superposición.</b>',
    welcomeCard0Small: 'Cada versión tuya es real ahora mismo.\nSereno. Valiente. Claro. Bloqueado. Asustado.\nTodas igualmente presentes. Ninguna más verdadera que otra.',
    welcomeCard1Big: 'El estado que <b>observas</b>\nes el estado que habitas.',
    welcomeCard1Small: 'Esto no es metáfora.\nEs la física de la atención.\nLo que mides, lo creas.',
    welcomeCard2Big: 'Cuatro movimientos.\nUn campo.',
    wlcMvLabels: ['Observar','Atestiguar','Colapsar','Quietud'],
    wlcMvHints: ['entrenar la atención','encontrar lo que hay','elegir un estado','aterrizar en ello'],
    wlcEnterBtn: 'entrar al campo',
    wlcTapHint: 'toca para continuar',
    fieldArrival: 'El campo está abierto.',
    fieldSub: 'la atención moldea el campo',
    observeLabel: 'Observar',
    collapseLabel: 'Colapsar',
    decohere_label: 'Atestiguar',
    observeHint: 'entrenar la atención',
    collapseHint: 'elegir un estado',
    decohereHint: 'encontrar lo que hay',
    stillLabel: 'Quietud',
    stillHint: 'aterrizar en ello',
    fieldLine: 'Estas versiones tuyas existen ahora mismo.',
    cLabel: 'colapsaste en',
    cSub: 'el campo sostiene esto ahora',
    ceqNote: '',
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
    decArrivalLine: '¿Qué está pidiendo ser visto?',
    decArrivalSub: 'Nombra lo que está presente.',
    decInhale: 'inhala · y una vez más',
    decExhale: 'exhala despacio',
    decEndLine: 'Fue visto.',
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
  en: ['Anxious','Heavy','Stuck','Numb','Scattered','Angry','Tired','Overwhelmed','Disconnected','Afraid','Confused','Uncertain'],
  es: ['Angustiado','Agobiado','Bloqueado','Apagado','Disperso','Enojado','Agotado','Sobrepasado','Desconectado','Asustado','Confundido','Incierto']
};

const STEPS = {
  en: [
    { big:'Right now,\nyou exist in <b>superposition.</b>', small:'Every version of you is real at this moment.\nCalm. Brave. Stuck. Clear. Afraid.\nAll equally present. None more true than another.', ps:'sp' },
    { big:'You already know this.', small:'You\'ve felt it — the version of you that knows how to be steady.\nThe version that knows how to begin.\nThey were always there, waiting to be observed.', ps:'all_labelled' },
    { big:'Observation does not reveal\nwhat is there.\nIt <b>creates</b> what is there.', small:'What you measure, you call into being.\nThis is not metaphor.\nIt is the physics of attention.', ps:'flicker' },
    { big:'These are particles\nin superposition.', small:'No definite state. Drifting. Undefined.\nEverywhere at once.\nUntil one is observed.', ps:'one' },
    { big:'The moment of observation\nis called <b>collapse.</b>', small:'Not loss. Not failure.\nThe moment infinite becomes real.\nYou chose one direction. It became this.', ps:'collapse_demo' },
    { big:'Your nervous system\nfollows the same physics.', small:'The state you observe most often\nbecomes the state that simply is you.\nThe others never disappeared — only unobserved.', ps:'stab' },
    { big:'You are about to run\nthis experiment on yourself.', small:'<b>Consciously.</b>', ps:'done', isLast:true }
  ],
  es: [
    { big:'Ahora mismo,\nexistes en <b>superposición.</b>', small:'Cada versión tuya es real en este momento.\nSereno. Valiente. Bloqueado. Claro. Asustado.\nTodas igualmente presentes. Ninguna más verdadera que otra.', ps:'sp' },
    { big:'Ya lo sabes.', small:'Lo has sentido — la versión de ti que sabe cómo mantenerse firme.\nLa versión que sabe cómo comenzar.\nSiempre estuvieron ahí, esperando ser observadas.', ps:'all_labelled' },
    { big:'La observación no revela\nlo que está ahí.\nLo <b>crea.</b>', small:'Lo que mides, lo convocas.\nEsto no es metáfora.\nEs la física de la atención.', ps:'flicker' },
    { big:'Estas son partículas\nen superposición.', small:'Sin estado definido. Derivando. Indefinidas.\nEn todas partes a la vez.\nHasta que una es observada.', ps:'one' },
    { big:'El momento de la observación\nse llama <b>colapso.</b>', small:'No es pérdida. No es fallo.\nEl momento en que lo infinito se vuelve real.\nElegiste una dirección. Se convirtió en esto.', ps:'collapse_demo' },
    { big:'Tu sistema nervioso\nsigue la misma física.', small:'El estado que observas con más frecuencia\nse convierte en el estado que simplemente eres.\nLos demás nunca desaparecieron — solo no fueron observados.', ps:'stab' },
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
    Anxious:      "Anxious was seen. You did not look away.",
    Heavy:        "You stayed with Heavy. That was enough.",
    Stuck:        "Stuck was here. You gave it your full attention.",
    Numb:         "Even Numb was met with presence.",
    Scattered:    "You held Scattered without needing to gather it.",
    Angry:        "Angry was seen clearly. Nothing had to change.",
    Tired:        "Tired was witnessed. Not fixed — seen.",
    Overwhelmed:  "You brought attention to Overwhelmed. That is the practice.",
    Disconnected: "Disconnected was not avoided. It was seen.",
    Afraid:       "You stayed with Afraid. Nothing needed to be resolved."
  },
  es: {
    Angustiado:   "Angustiado fue visto. No apartaste la mirada.",
    Agobiado:     "Te quedaste con Agobiado. Eso fue suficiente.",
    Bloqueado:    "Bloqueado estuvo aquí. Le diste toda tu atención.",
    Apagado:      "Incluso Apagado fue encontrado con presencia.",
    Disperso:     "Sostuviste Disperso sin necesidad de recogerlo.",
    Enojado:      "Enojado fue visto claramente. Nada tuvo que cambiar.",
    Agotado:      "Agotado fue atestiguado. No arreglado — visto.",
    Sobrepasado:  "Trajiste atención a Sobrepasado. Esa es la práctica.",
    Desconectado: "Desconectado no fue evitado. Fue visto.",
    Asustado:     "Te quedaste con Asustado. Nada necesitaba resolverse."
  }
};
