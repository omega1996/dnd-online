import { ref, computed } from "vue";
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy,
  doc,
  updateDoc,
  deleteDoc,
  getDoc
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./useAuth";

const { user } = useAuth();
const characters = ref([]);
const loading = ref(false);
const error = ref(null);

// Преобразование вложенных массивов в объекты для Firestore
function arraysToObjects(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    const result = {};
    obj.forEach((item, index) => {
      result[index.toString()] = arraysToObjects(item);
    });
    return result;
  }
  
  if (typeof obj === 'object' && obj.constructor === Object) {
    const result = {};
    Object.keys(obj).forEach(key => {
      result[key] = arraysToObjects(obj[key]);
    });
    return result;
  }
  
  return obj;
}

// Преобразование объектов обратно в массивы при чтении из Firestore
function objectsToArrays(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'object' && obj.constructor === Object) {
    // Проверяем, является ли это объектом-массивом (все ключи - числа)
    const keys = Object.keys(obj);
    const isArrayLike = keys.length > 0 && keys.every(key => /^\d+$/.test(key));
    
    if (isArrayLike) {
      // Преобразуем в массив
      const maxIndex = Math.max(...keys.map(k => parseInt(k)));
      const result = [];
      for (let i = 0; i <= maxIndex; i++) {
        result[i] = objectsToArrays(obj[i.toString()]);
      }
      return result;
    } else {
      // Обычный объект
      const result = {};
      Object.keys(obj).forEach(key => {
        result[key] = objectsToArrays(obj[key]);
      });
      return result;
    }
  }
  
  return obj;
}

// Получить всех персонажей текущего пользователя
async function fetchCharacters() {
  if (!user.value) {
    characters.value = [];
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const charactersRef = collection(db, "characters");
    const q = query(
      charactersRef,
      where("userId", "==", user.value.uid),
      orderBy("createdAt", "desc")
    );
    
    const querySnapshot = await getDocs(q);
    characters.value = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      // Преобразуем объекты обратно в массивы при чтении
      if (data.characterData) {
        data.characterData = objectsToArrays(data.characterData);
      }
      return {
        id: doc.id,
        ...data,
      };
    });
  } catch (err) {
    console.error("Error fetching characters:", err);
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

// Создать нового персонажа
async function createCharacter(characterData) {
  if (!user.value) {
    throw new Error("User must be authenticated");
  }

  loading.value = true;
  error.value = null;

  try {
    const charactersRef = collection(db, "characters");
    
    // Если передана полная структура DND (characterData.characterData), используем её
    let newCharacter;
    if (characterData.characterData) {
      // Преобразуем вложенные массивы в объекты для Firestore
      const characterDataForFirestore = arraysToObjects(characterData.characterData);
      
      // Сохраняем полную структуру DND
      newCharacter = {
        userId: user.value.uid,
        player_name: characterData.player_name || characterData.name,
        characterData: characterDataForFirestore,
        imageUrl: characterData.imageUrl,
        tokenId: null, // ID токена на доске (если добавлен)
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } else {
      // Обратная совместимость со старой структурой
      newCharacter = {
        userId: user.value.uid,
        name: characterData.name,
        imageUrl: characterData.imageUrl,
        stats: {
          health: characterData.stats?.health || 100,
          agility: characterData.stats?.agility || 10,
          strength: characterData.stats?.strength || 10,
          intelligence: characterData.stats?.intelligence || 10,
        },
        tokenId: null, // ID токена на доске (если добавлен)
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    const docRef = await addDoc(charactersRef, newCharacter);
    await fetchCharacters(); // Обновляем список
    return docRef.id;
  } catch (err) {
    console.error("Error creating character:", err);
    error.value = err.message;
    throw err;
  } finally {
    loading.value = false;
  }
}

// Обновить персонажа
async function updateCharacter(characterId, updates) {
  if (!user.value) {
    throw new Error("User must be authenticated");
  }

  loading.value = true;
  error.value = null;

  try {
    const characterRef = doc(db, "characters", characterId);
    const characterDoc = await getDoc(characterRef);
    
    if (!characterDoc.exists()) {
      throw new Error("Character not found");
    }

    const characterData = characterDoc.data();
    if (characterData.userId !== user.value.uid) {
      throw new Error("Permission denied");
    }

    // Преобразуем вложенные массивы в объекты для Firestore, если есть characterData в updates
    const updatesForFirestore = { ...updates };
    if (updatesForFirestore.characterData) {
      updatesForFirestore.characterData = arraysToObjects(updatesForFirestore.characterData);
    }

    await updateDoc(characterRef, {
      ...updatesForFirestore,
      updatedAt: new Date(),
    });

    await fetchCharacters(); // Обновляем список
  } catch (err) {
    console.error("Error updating character:", err);
    error.value = err.message;
    throw err;
  } finally {
    loading.value = false;
  }
}

// Удалить персонажа
async function deleteCharacter(characterId) {
  if (!user.value) {
    throw new Error("User must be authenticated");
  }

  loading.value = true;
  error.value = null;

  try {
    const characterRef = doc(db, "characters", characterId);
    const characterDoc = await getDoc(characterRef);
    
    if (!characterDoc.exists()) {
      throw new Error("Character not found");
    }

    const characterData = characterDoc.data();
    if (characterData.userId !== user.value.uid) {
      throw new Error("Permission denied");
    }

    await deleteDoc(characterRef);
    await fetchCharacters(); // Обновляем список
  } catch (err) {
    console.error("Error deleting character:", err);
    error.value = err.message;
    throw err;
  } finally {
    loading.value = false;
  }
}

// Получить персонажа по ID (только для чтения, без проверки владельца)
async function getCharacterByIdReadOnly(characterId) {
  if (!user.value) {
    throw new Error("User must be authenticated");
  }

  if (!characterId) {
    console.warn("getCharacterByIdReadOnly: characterId is required");
    return null;
  }

  try {
    console.log("Loading character from Firebase, characterId:", characterId);
    const characterRef = doc(db, "characters", characterId);
    const characterDoc = await getDoc(characterRef);
    
    if (!characterDoc.exists()) {
      console.warn("Character document does not exist, characterId:", characterId);
      return null;
    }

    const characterData = characterDoc.data();
    console.log("Character data loaded from Firebase:", characterDoc.id);

    // Преобразуем объекты обратно в массивы при чтении
    if (characterData.characterData) {
      characterData.characterData = objectsToArrays(characterData.characterData);
    }

    return {
      id: characterDoc.id,
      ...characterData,
    };
  } catch (err) {
    console.error("Error getting character from Firebase:", err);
    console.error("CharacterId:", characterId);
    console.error("Error details:", {
      code: err.code,
      message: err.message,
      stack: err.stack
    });
    error.value = err.message;
    throw err;
  }
}

// Получить персонажа по ID (с проверкой владельца для редактирования)
async function getCharacterById(characterId) {
  if (!user.value) {
    throw new Error("User must be authenticated");
  }

  try {
    const characterRef = doc(db, "characters", characterId);
    const characterDoc = await getDoc(characterRef);
    
    if (!characterDoc.exists()) {
      return null;
    }

    const characterData = characterDoc.data();
    if (characterData.userId !== user.value.uid) {
      throw new Error("Permission denied");
    }

    // Преобразуем объекты обратно в массивы при чтении
    if (characterData.characterData) {
      characterData.characterData = objectsToArrays(characterData.characterData);
    }

    return {
      id: characterDoc.id,
      ...characterData,
    };
  } catch (err) {
    console.error("Error getting character:", err);
    error.value = err.message;
    throw err;
  }
}

// Получить персонажа по tokenId (для поиска персонажа по токену на доске)
async function getCharacterByTokenId(tokenId) {
  if (!user.value || !tokenId) {
    return null;
  }

  try {
    const charactersRef = collection(db, "characters");
    const q = query(
      charactersRef,
      where("tokenId", "==", tokenId)
    );
    
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return null;
    }

    const characterDoc = querySnapshot.docs[0];
    const characterData = characterDoc.data();
    
    // Преобразуем объекты обратно в массивы при чтении
    if (characterData.characterData) {
      characterData.characterData = objectsToArrays(characterData.characterData);
    }
    
    // Проверяем, что персонаж принадлежит текущему пользователю или доступен всем
    // Для начала сделаем доступным всем, кто может видеть токен
    return {
      id: characterDoc.id,
      ...characterData,
    };
  } catch (err) {
    console.error("Error getting character by tokenId:", err);
    return null;
  }
}

export function useCharacters() {
  return {
    characters: computed(() => characters.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    fetchCharacters,
    createCharacter,
    updateCharacter,
    deleteCharacter,
    getCharacterById,
    getCharacterByIdReadOnly,
    getCharacterByTokenId,
  };
}
