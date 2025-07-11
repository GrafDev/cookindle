// Конфигурация приложения Cookindle
export const CONFIG = {
    // Параметры layout
    layout: {
        minWidth: 350,
        maxWidth: 800,
        widthPercent: 90, // процент от viewport width
        heightPercent: 80, // процент от viewport height
        maxHeight: 800,
        padding: 20,
        borderRadius: 10
    },
    
    // Параметры игровой области
    gameArea: {
        borderRadius: 5,
        backgroundColor: '#fafafa'
    },
    
    // Параметры PixiJS
    pixi: {
        backgroundColor: 0x1099bb
    },
    
    // Параметры печенья
    cookie: {
        sizePercent: 0.8, // Размер печенья в процентах от минимальной стороны экрана
        painting: "circle", // "circle", "star", "cross"
        patternColor: 0x3C1810, // Цвет узора (темно-коричневый)
        patternCount: 15, // Количество элементов узора
        patternSize: {
            min: 8,
            max: 20
        }
    },
    
    // Параметры центральной формы
    centerShape: {
        form: 1, // 1 - круг, 2 - квадрат, 3 - треугольник
        sizePercent: 0.6, // Размер формы в процентах от печенья
        color: 0xEB8D27, // Цвет обводки (оранжевый)
        lineWidth: 11, // Толщина линии
        alpha: 0.9, // Прозрачность
        borderRadius: 8, // Радиус скругления углов для квадрата и треугольника
        // Параметры пульсирующей обводки
        pulse: {
            enabled: true, // Включить пульсацию
            colorFrom: 0xf93e00, // Начальный цвет (золотистый)
            colorTo: 0x000000, // Конечный цвет (оранжево-красный)
            lineWidth: 2, // Толщина пульсирующей линии
            alpha: 0.8, // Общая прозрачность
            speed: 0.4, // Скорость пульсации (циклов в секунду)
            dashed: true, // Пунктирная линия
            dashLength: 2, // Длина штриха
            gapLength: 8 // Длина промежутка
        }
    },
    
    // Параметры иглы
    needle: {
        textureUrl: './src/assets/textures/needle.png',
        mouseOffset: { x: 0, y: 1 }, // Левый нижний угол для мыши
        touchOffset: { x: 0.5, y: 0.5 }, // Центр для пальца
        sizePercent: 50, // Размер иглы в процентах от печенья
        visible: false, // Начальная видимость
        // Параметры тени
        shadow: {
            distance: 10, // Расстояние от точки клика (px)
            alpha: 0.5, // Прозрачность тени
            animationDuration: 0.1 // Длительность анимации нажатия в секундах
        },
        // Позиция на мобильных устройствах
        mobile: {
            staticPosition: { x: 0.85, y: 0.5 }, // Позиция справа (в процентах от экрана)
            animationDuration: 0.3 // Время перемещения к касанию
        }
    },
    
    // Параметры системы трещин и отколов
    cracks: {
        // Количество трещин от одного нажатия
        count: {
            min: 2,
            max: 4
        },
        // Длина трещин
        length: {
            min: 50,
            max: 120
        },
        // Толщина линий трещин
        lineWidth: 2,
        // Цвет трещин
        color: 0x8B4513, // Темно-коричневый
        // Прозрачность
        alpha: 0.8,
        // Угол разброса (в радианах)
        angleSpread: Math.PI * 2, // Полный круг
        // Случайность направления
        randomness: 0.3,
        // Скорость анимации появления трещин
        animationSpeed: 0.05,
        // Сегментирование трещин для анимации
        segments: 20
    },
    
    // Параметры осколков
    chips: {
        // Минимальный размер осколка для выпадения
        minSize: 30,
        // Физика падения
        physics: {
            gravity: 0.5,
            initialVelocity: {
                x: { min: -2, max: 2 },
                y: { min: -5, max: -2 }
            },
            rotation: { min: -0.1, max: 0.1 },
            fadeSpeed: 0.02
        },
        // Визуальные эффекты
        visual: {
            scaleReduction: 0.8, // Уменьшение размера при падении
            color: 0xD2691E // Цвет осколков
        }
    },
    
    // Dev настройки
    dev: {
        showBorders: true,
        showLabels: true,
        consoleLogging: true,
        // Принудительная отладка для мобильных (даже в продакшене)
        forceMobileDebug: true
    }
};