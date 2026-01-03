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
    characters.value = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
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
    const newCharacter = {
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

    await updateDoc(characterRef, {
      ...updates,
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

// Получить персонажа по ID
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
    getCharacterByTokenId,
  };
}
