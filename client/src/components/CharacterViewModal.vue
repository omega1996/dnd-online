<script setup>
import { computed } from "vue";

const props = defineProps({
  character: {
    type: Object,
    required: true,
  },
  // Токены на доске для получения актуальных hit points
  roomTokens: {
    type: Object,
    default: () => ({}),
  },
  // Функция для броска кастомного кубика
  onCustomRoll: {
    type: Function,
    default: null,
  },
});

const emit = defineEmits(["close"]);

// Получаем данные персонажа из новой структуры или старой
const charData = computed(() => {
  if (props.character?.characterData?.character?.[0]) {
    return props.character.characterData.character[0];
  }
  return null;
});

// Имя персонажа
const characterName = computed(() => {
  if (charData.value) {
    return charData.value.character_name || props.character?.player_name || props.character?.name || "Unknown";
  }
  return props.character?.player_name || props.character?.name || "Unknown";
});

// Имя игрока
const playerName = computed(() => {
  return props.character?.player_name || props.character?.name || "Unknown";
});

// Abilities и bonuses
const abilitiesData = computed(() => {
  if (charData.value?.abilities_bonuses?.[0]) {
    return {
      abilities: charData.value.abilities_bonuses[0].abilities || {},
      bonuses: charData.value.abilities_bonuses[0].bonuses || {},
    };
  }
  return null;
});

// Находим токен этого персонажа на доске
const tokenOnBoard = computed(() => {
  if (!props.character?.id || !props.roomTokens) {
    return null;
  }
  const token = Object.values(props.roomTokens).find(
    (token) => token.characterId === props.character.id
  );
  return token || null;
});

// HP данные - используем из токена если он на доске, иначе из данных персонажа
const hpData = computed(() => {
  // Если токен на доске и у него есть hitPoints, используем их
  if (tokenOnBoard.value && tokenOnBoard.value.hitPoints !== null && tokenOnBoard.value.hitPoints !== undefined) {
    // Получаем максимальные HP из данных персонажа
    const maxHp = charData.value?.hp?.[0]?.hp_max || tokenOnBoard.value.hitPoints;
    return {
      current: tokenOnBoard.value.hitPoints,
      max: maxHp,
    };
  }
  
  // Иначе используем данные из персонажа
  if (charData.value?.hp?.[0]) {
    return {
      current: charData.value.hp[0].hp_current,
      max: charData.value.hp[0].hp_max,
    };
  }
  return null;
});

// Скиллы
const skills = computed(() => {
  if (charData.value?.skills) {
    const skillsObj = charData.value.skills;
    const skillsList = [];
    
    // Фильтруем только скиллы (не check поля)
    Object.keys(skillsObj).forEach(key => {
      if (!key.endsWith('-check') && typeof skillsObj[key] === 'string') {
        skillsList.push({
          name: key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          value: skillsObj[key],
          proficient: skillsObj[key + '-check'] || false,
        });
      }
    });
    
    return skillsList.sort((a, b) => a.name.localeCompare(b.name));
  }
  return [];
});

// Оружие
const weapons = computed(() => {
  if (charData.value?.equipment?.[0]?.weapons) {
    return charData.value.equipment[0].weapons.map(w => ({
      name: Array.isArray(w) ? w[0] : w,
      data: Array.isArray(w) ? w[1] : null,
    }));
  }
  return [];
});

// Магическое оружие
const magicWeapons = computed(() => {
  if (charData.value?.equipment?.[0]?.magic_weapons) {
    return charData.value.equipment[0].magic_weapons.map(w => ({
      name: Array.isArray(w) ? w[0] : w,
      data: Array.isArray(w) ? w[1] : null,
    }));
  }
  return [];
});

// Атаки
const attacks = computed(() => {
  if (charData.value?.attacks) {
    const att = charData.value.attacks;
    const attacksList = [];
    
    // Извлекаем атаки из структуры
    let i = 1;
    while (att[`weapon-name-${i}`]) {
      attacksList.push({
        name: att[`weapon-name-${i}`],
        attackBonus: att[`weapon-attack-bonus-${i}`],
        damage: att[`weapon-damage-${i}`],
      });
      i++;
    }
    
    return attacksList;
  }
  return [];
});

// Классы
const classes = computed(() => {
  if (charData.value?.classes) {
    return Object.keys(charData.value.classes).map(key => ({
      name: charData.value.classes[key]['class-name'] || key,
      level: charData.value.classes[key]['class-level'] || 0,
      hitDie: charData.value.classes[key]['hit-die'] || 0,
    }));
  }
  return [];
});

// Получаем imageUrl из правильного места
const imageUrl = computed(() => {
  return props.character?.imageUrl || 
         props.character?.characterData?.character?.[0]?.image_url || 
         null;
});

// Парсинг строки урона (например "1d4+1 piercing" или "1d8+2 bludgeoning")
function parseDamageString(damageString) {
  if (!damageString || typeof damageString !== 'string') {
    return null;
  }
  
  // Убираем тип урона (piercing, bludgeoning и т.д.)
  const withoutType = damageString.trim().split(/\s+/)[0];
  
  // Парсим формат типа "1d4+1" или "1d8+2" или "2d6" или "1d4-1"
  const match = withoutType.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  
  if (!match) {
    return null;
  }
  
  const diceCount = parseInt(match[1], 10);
  const diceSides = parseInt(match[2], 10);
  const modifier = match[3] ? parseInt(match[3], 10) : 0;
  
  return {
    diceCount,
    diceSides,
    modifier,
  };
}

// Бросок кубика урона
function rollDamage(damageString) {
  if (!props.onCustomRoll) {
    return;
  }
  
  const parsed = parseDamageString(damageString);
  if (!parsed) {
    console.error('Не удалось распарсить строку урона:', damageString);
    return;
  }
  
  // Бросаем кубики
  const results = [];
  for (let i = 0; i < parsed.diceCount; i++) {
    results.push(Math.floor(Math.random() * parsed.diceSides) + 1);
  }
  
  // Суммируем результаты
  const sum = results.reduce((acc, val) => acc + val, 0) + parsed.modifier;
  
  // Формируем описание в формате как в CustomDiceModal (например "D4+1" или "D6+D6+2")
  const diceParts = Array(parsed.diceCount).fill(parsed.diceSides).map(sides => `D${sides}`).join('+');
  const modifierStr = parsed.modifier !== 0 
    ? (parsed.modifier > 0 ? `+${parsed.modifier}` : `${parsed.modifier}`)
    : '';
  const description = diceParts + modifierStr;
  
  // Отправляем данные для броска
  props.onCustomRoll({
    dice: Array(parsed.diceCount).fill(parsed.diceSides),
    results: results,
    modifier: parsed.modifier,
    sum: sum,
    description: description,
  });
}
</script>

<template>
  <div
    style="
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    "
    @click.self="$emit('close')"
  >
    <div
      style="
        background: white;
        border-radius: 12px;
        padding: 24px;
        max-width: 500px;
        width: 90%;
        max-height: 90vh;
        overflow-y: auto;
      "
    >
      <div
        style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        "
      >
        <div>
          <h2 style="margin: 0; font-size: 20px">{{ characterName }}</h2>
          <div style="font-size: 14px; color: #666; margin-top: 4px">
            Player: {{ playerName }}
          </div>
        </div>
        <button
          @click="$emit('close')"
          style="
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #666;
            padding: 0;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
          "
        >
          ×
        </button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 20px">
        <!-- Изображение персонажа -->
        <div style="text-align: center" v-if="imageUrl">
          <img
            :src="imageUrl"
            :alt="characterName"
            style="
              max-width: 200px;
              max-height: 200px;
              border-radius: 8px;
              border: 2px solid #ddd;
            "
          />
        </div>

        <!-- Если есть данные DND, показываем полную информацию -->
        <template v-if="charData">
          <!-- Основная информация -->
          <div>
            <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600">Basic Information</h3>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; font-size: 14px">
              <div v-if="charData.race">
                <strong>Race:</strong> {{ charData.race }}<span v-if="charData.subrace"> ({{ charData.subrace }})</span>
              </div>
              <div v-if="charData.alignment">
                <strong>Alignment:</strong> {{ charData.alignment }}
              </div>
              <div v-if="classes.length > 0">
                <strong>Class:</strong> {{ classes.map(c => `${c.name} ${c.level}`).join(', ') }}
              </div>
              <div v-if="charData.proficiency_bonus">
                <strong>Proficiency Bonus:</strong> +{{ charData.proficiency_bonus }}
              </div>
              <div v-if="charData.ac">
                <strong>AC:</strong> {{ charData.ac }}
              </div>
              <div v-if="charData.initiative_bonus !== undefined">
                <strong>Initiative:</strong> {{ charData.initiative_bonus >= 0 ? '+' : '' }}{{ charData.initiative_bonus }}
              </div>
            </div>
          </div>

          <!-- HP -->
          <div v-if="hpData">
            <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600">Hit Points</h3>
            <div style="padding: 12px; background: #f8f9fa; border-radius: 8px; text-align: center">
              <div style="font-size: 24px; font-weight: bold; color: #dc3545">
                {{ hpData.current !== null ? hpData.current : '?' }} / {{ hpData.max }}
              </div>
            </div>
          </div>

          <!-- Abilities -->
          <div v-if="abilitiesData">
            <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600">Abilities</h3>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px">
              <div
                v-for="(value, key) in abilitiesData.abilities"
                :key="key"
                style="
                  padding: 12px;
                  background: #f8f9fa;
                  border-radius: 8px;
                  text-align: center;
                "
              >
                <div style="font-size: 12px; color: #666; margin-bottom: 4px; text-transform: uppercase">
                  {{ key }}
                </div>
                <div style="font-size: 20px; font-weight: bold; color: #333">
                  {{ value }}
                </div>
                <div style="font-size: 12px; color: #666; margin-top: 2px">
                  ({{ abilitiesData.bonuses[key] >= 0 ? '+' : '' }}{{ abilitiesData.bonuses[key] }})
                </div>
              </div>
            </div>
          </div>

          <!-- Skills -->
          <div v-if="skills.length > 0">
            <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600">Skills</h3>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 14px">
              <div
                v-for="skill in skills"
                :key="skill.name"
                style="
                  padding: 8px;
                  background: #f8f9fa;
                  border-radius: 6px;
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                "
              >
                <span>
                  <span v-if="skill.proficient" style="color: #28a745; margin-right: 4px">✓</span>
                  {{ skill.name }}
                </span>
                <strong>{{ skill.value }}</strong>
              </div>
            </div>
          </div>

          <!-- Weapons -->
          <div v-if="weapons.length > 0 || magicWeapons.length > 0">
            <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600">Weapons</h3>
            <div style="display: flex; flex-direction: column; gap: 8px">
              <div
                v-for="weapon in weapons"
                :key="weapon.name"
                style="
                  padding: 10px;
                  background: #f8f9fa;
                  border-radius: 6px;
                  font-size: 14px;
                "
              >
                <strong>{{ weapon.name }}</strong>
                <span v-if="weapon.data?.quantity" style="color: #666; margin-left: 8px">
                  (x{{ weapon.data.quantity }})
                </span>
              </div>
              <div
                v-for="weapon in magicWeapons"
                :key="weapon.name"
                style="
                  padding: 10px;
                  background: #e7f3ff;
                  border-radius: 6px;
                  font-size: 14px;
                "
              >
                <strong>{{ weapon.name }}</strong>
                <span style="color: #007bff; margin-left: 8px">(Magic)</span>
                <span v-if="weapon.data?.quantity" style="color: #666; margin-left: 8px">
                  (x{{ weapon.data.quantity }})
                </span>
              </div>
            </div>
          </div>

          <!-- Attacks -->
          <div v-if="attacks.length > 0">
            <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600">Attacks</h3>
            <div style="display: flex; flex-direction: column; gap: 12px">
              <div
                v-for="attack in attacks"
                :key="attack.name"
                style="
                  padding: 12px;
                  background: #f8f9fa;
                  border-radius: 8px;
                "
              >
                <div style="font-weight: 600; margin-bottom: 4px">{{ attack.name }}</div>
                <div style="font-size: 14px; color: #666; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                  <span>
                    Attack: <strong>{{ attack.attackBonus }}</strong> | Damage: <strong>{{ attack.damage }}</strong>
                  </span>
                  <button
                    v-if="onCustomRoll && attack.damage"
                    @click="rollDamage(attack.damage)"
                    style="
                      padding: 4px 12px;
                      border-radius: 4px;
                      border: 1px solid #007bff;
                      background: #007bff;
                      color: white;
                      cursor: pointer;
                      font-size: 12px;
                      font-weight: 500;
                      margin-left: auto;
                      transition: all 0.2s;
                    "
                    @mouseenter="$event.target.style.background = '#0056b3'"
                    @mouseleave="$event.target.style.background = '#007bff'"
                    title="Кинуть кубик урона"
                  >
                    🎲 Бросить урон
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Traits -->
          <div v-if="charData.traits?.['features-and-traits-2']">
            <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600">Features & Traits</h3>
            <div style="padding: 12px; background: #f8f9fa; border-radius: 8px; white-space: pre-wrap; font-size: 14px; line-height: 1.6">
              {{ charData.traits['features-and-traits-2'] }}
            </div>
          </div>

          <!-- Characteristics -->
          <div v-if="charData.characteristics?.[0]">
            <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600">Characteristics</h3>
            <div style="display: flex; flex-direction: column; gap: 8px; font-size: 14px">
              <div v-if="charData.characteristics[0].age">
                <strong>Age:</strong> {{ charData.characteristics[0].age }}
              </div>
              <div v-if="charData.characteristics[0].sex">
                <strong>Sex:</strong> {{ charData.characteristics[0].sex }}
              </div>
              <div v-if="charData.characteristics[0].height">
                <strong>Height:</strong> {{ charData.characteristics[0].height }}
              </div>
              <div v-if="charData.characteristics[0].weight">
                <strong>Weight:</strong> {{ charData.characteristics[0].weight }}
              </div>
              <div v-if="charData.characteristics[0].eyes">
                <strong>Eyes:</strong> {{ charData.characteristics[0].eyes }}
              </div>
              <div v-if="charData.characteristics[0].hair">
                <strong>Hair:</strong> {{ charData.characteristics[0].hair }}
              </div>
              <div v-if="charData.characteristics[0].skin">
                <strong>Skin:</strong> {{ charData.characteristics[0].skin }}
              </div>
              <div v-if="charData.characteristics[0]['personality_trait_1']">
                <strong>Personality Trait:</strong> {{ charData.characteristics[0]['personality_trait_1'] }}
              </div>
              <div v-if="charData.characteristics[0]['personality-trait-2']">
                <strong>Personality Trait 2:</strong> {{ charData.characteristics[0]['personality-trait-2'] }}
              </div>
              <div v-if="charData.characteristics[0].ideals">
                <strong>Ideals:</strong> {{ charData.characteristics[0].ideals }}
              </div>
              <div v-if="charData.characteristics[0].bonds">
                <strong>Bonds:</strong> {{ charData.characteristics[0].bonds }}
              </div>
              <div v-if="charData.characteristics[0].flaws">
                <strong>Flaws:</strong> {{ charData.characteristics[0].flaws }}
              </div>
              <div v-if="charData.characteristics[0].character_backstory" style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #ddd">
                <strong>Backstory:</strong>
                <div style="margin-top: 4px; white-space: pre-wrap; line-height: 1.6">
                  {{ charData.characteristics[0].character_backstory }}
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- Обратная совместимость: старая структура -->
        <template v-else>
          <div>
            <h3 style="margin: 0 0 16px 0; font-size: 18px">Stats</h3>
            <div
              style="
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 16px;
              "
            >
              <div
                style="
                  padding: 16px;
                  background: #f8f9fa;
                  border-radius: 8px;
                  text-align: center;
                "
              >
                <div style="font-size: 12px; color: #666; margin-bottom: 4px">
                  Health
                </div>
                <div style="font-size: 24px; font-weight: bold; color: #dc3545">
                  {{ props.character?.stats?.health || 0 }}
                </div>
              </div>

              <div
                style="
                  padding: 16px;
                  background: #f8f9fa;
                  border-radius: 8px;
                  text-align: center;
                "
              >
                <div style="font-size: 12px; color: #666; margin-bottom: 4px">
                  Agility
                </div>
                <div style="font-size: 24px; font-weight: bold; color: #28a745">
                  {{ props.character?.stats?.agility || 0 }}
                </div>
              </div>

              <div
                style="
                  padding: 16px;
                  background: #f8f9fa;
                  border-radius: 8px;
                  text-align: center;
                "
              >
                <div style="font-size: 12px; color: #666; margin-bottom: 4px">
                  Strength
                </div>
                <div style="font-size: 24px; font-weight: bold; color: #ffc107">
                  {{ props.character?.stats?.strength || 0 }}
                </div>
              </div>

              <div
                style="
                  padding: 16px;
                  background: #f8f9fa;
                  border-radius: 8px;
                  text-align: center;
                "
              >
                <div style="font-size: 12px; color: #666; margin-bottom: 4px">
                  Intelligence
                </div>
                <div style="font-size: 24px; font-weight: bold; color: #007bff">
                  {{ props.character?.stats?.intelligence || 0 }}
                </div>
              </div>
            </div>
          </div>
        </template>

        <div style="display: flex; justify-content: flex-end; margin-top: 8px">
          <button
            @click="$emit('close')"
            style="
              padding: 10px 20px;
              border-radius: 6px;
              border: 1px solid #ccc;
              background: white;
              cursor: pointer;
              font-weight: 500;
            "
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
