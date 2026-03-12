import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, PanResponder, Animated, ScrollView, TextInput, Alert, Dimensions } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons, Ionicons, FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [currentScreen, setCurrentScreen] = useState('menu'); 

  // Taslak Sistemi
  const [drafts, setDrafts] = useState([]);
  const [draftCounter, setDraftCounter] = useState(1);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedDrafts, setSelectedDrafts] = useState([]);
  const [deletedDraftInfo, setDeletedDraftInfo] = useState(null);

  // Favoriler Sistemi
  const [favorites, setFavorites] = useState([]);
  const [isFavSelectMode, setIsFavSelectMode] = useState(false);
  const [selectedFavs, setSelectedFavs] = useState([]);
  
  const [isLoaded, setIsLoaded] = useState(false); 

  // --- KALICI DEPOLAMA (ASYNC STORAGE) ---
  useEffect(() => {
    const loadData = async () => {
      try {
        const savedDrafts = await AsyncStorage.getItem('@drafts');
        const savedCounter = await AsyncStorage.getItem('@draftCounter');
        const savedFavs = await AsyncStorage.getItem('@favorites');
        if (savedDrafts !== null) setDrafts(JSON.parse(savedDrafts));
        if (savedCounter !== null) setDraftCounter(parseInt(savedCounter, 10));
        if (savedFavs !== null) setFavorites(JSON.parse(savedFavs));
      } catch (e) {
        console.error("Hafıza yüklenirken hata:", e);
      } finally {
        setIsLoaded(true);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (isLoaded) {
      const saveData = async () => {
        try {
          await AsyncStorage.setItem('@drafts', JSON.stringify(drafts));
          await AsyncStorage.setItem('@draftCounter', draftCounter.toString());
          await AsyncStorage.setItem('@favorites', JSON.stringify(favorites));
        } catch (e) {
          console.error("Hafızaya kaydedilirken hata:", e);
        }
      };
      saveData();
    }
  }, [drafts, draftCounter, favorites, isLoaded]);

  // Editör State
  const [image, setImage] = useState(null);
  const [opacity, setOpacity] = useState(0.5);
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [cameraZoom, setCameraZoom] = useState(0);

  // Çekmece Animasyonları
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const drawerAnim = useRef(new Animated.Value(0)).current; 

  const isLockedRef = useRef(false);
  const zoomRef = useRef(0);

  const pan = useRef(new Animated.ValueXY()).current;
  const scale = useRef(new Animated.Value(1)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const focusX = useRef(new Animated.Value(0)).current;
  const focusY = useRef(new Animated.Value(0)).current;
  const focusOpacity = useRef(new Animated.Value(0)).current;

  const panRef = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const rotateRef = useRef(0);
  const historyRef = useRef([]);

  const prevTouches = useRef(0);
  const initialDist = useRef(1);
  const initialAngle = useRef(0);
  const startScale = useRef(1);
  const startRotate = useRef(0);

  pan.addListener((value) => { panRef.current = value; });
  scale.addListener(({ value }) => { scaleRef.current = value; });
  rotate.addListener(({ value }) => { rotateRef.current = value; });

  const handleLockToggle = () => { setIsLocked(!isLocked); isLockedRef.current = !isLocked; };

  const toggleDrawer = () => {
    Animated.spring(drawerAnim, {
      toValue: isDrawerOpen ? 1 : 0,
      useNativeDriver: false,
      bounciness: 10,
      speed: 14
    }).start();
    setIsDrawerOpen(!isDrawerOpen);
  };

  const menuTranslateY = drawerAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 250] });
  const toggleTranslateY = drawerAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 90] });
  const toggleRadius = drawerAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 20] });
  const toggleBorder = drawerAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  const saveToHistory = () => {
    historyRef.current.push({ x: panRef.current.x, y: panRef.current.y, scale: scaleRef.current, rotate: rotateRef.current });
    if (historyRef.current.length > 30) historyRef.current.shift();
  };

  const handleUndo = () => {
    if (historyRef.current.length > 0) {
      const prevState = historyRef.current.pop();
      pan.setOffset({ x: 0, y: 0 });
      pan.setValue({ x: prevState.x, y: prevState.y });
      scale.setValue(prevState.scale);
      rotate.setValue(prevState.rotate);
    }
  };

  const handleReset = () => {
    saveToHistory();
    pan.setOffset({ x: 0, y: 0 });
    pan.setValue({ x: 0, y: 0 });
    scale.setValue(1);
    rotate.setValue(0);
  };

  const saveDraft = () => {
    const newDraft = {
      id: Date.now().toString(),
      name: `Taslak ${draftCounter}`,
      uri: image,
      timestamp: Date.now(),
      state: { panX: panRef.current.x, panY: panRef.current.y, scale: scaleRef.current, rotate: rotateRef.current, opacity: opacity }
    };
    setDrafts([newDraft, ...drafts]);
    setDraftCounter(draftCounter + 1);
    Alert.alert("Başarılı", "Taslak başarıyla kaydedildi!");
  };

  const loadToEditor = (uri) => {
    setImage(uri);
    setOpacity(0.5);
    pan.setOffset({ x: 0, y: 0 });
    pan.setValue({ x: 0, y: 0 });
    scale.setValue(1);
    rotate.setValue(0);
    setCameraZoom(0);
    zoomRef.current = 0;
    historyRef.current = [];
    setIsLocked(false);
    isLockedRef.current = false;
    setCurrentScreen('editor');
  };

  const loadDraft = (draft) => {
    setImage(draft.uri);
    setOpacity(draft.state.opacity);
    pan.setOffset({ x: 0, y: 0 });
    pan.setValue({ x: draft.state.panX, y: draft.state.panY });
    scale.setValue(draft.state.scale);
    rotate.setValue(draft.state.rotate);
    historyRef.current = [];
    setIsLocked(false);
    isLockedRef.current = false;
    setCurrentScreen('editor');
  };

  // --- FAVORİLER İŞLEMLERİ ---
  const pickAndSaveFavorites = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 1,
    });
    if (!result.canceled) {
      const newFavs = [];
      for (const asset of result.assets) {
        newFavs.push({
          id: Date.now().toString() + Math.random().toString(),
          uri: asset.uri, 
          name: `Favori ${favorites.length + newFavs.length + 1}`,
          completed: false,
          timestamp: Date.now()
        });
      }
      setFavorites([...newFavs, ...favorites]);
      Alert.alert("Başarılı", `${newFavs.length} resim favorilere eklendi.`);
    }
  };

  const toggleFavCompleted = (id) => {
    setFavorites(favorites.map(fav => fav.id === id ? { ...fav, completed: !fav.completed } : fav));
  };

  const updateFavName = (id, newName) => {
    setFavorites(favorites.map(f => f.id === id ? { ...f, name: newName } : f));
  };

  const confirmDeleteFav = (fav) => {
    Alert.alert("Favoriyi Sil", "Bu favoriyi silmek istiyor musun?", [
      { text: "İptal", style: "cancel" },
      { text: "Sil", style: "destructive", onPress: () => {
          setFavorites(favorites.filter(f => f.id !== fav.id));
      }}
    ]);
  };

  const toggleFavSelection = (id) => {
    if (selectedFavs.includes(id)) setSelectedFavs(selectedFavs.filter(favId => favId !== id));
    else setSelectedFavs([...selectedFavs, id]);
  };

  const bulkDeleteFavs = () => {
    if (selectedFavs.length === 0) return;
    Alert.alert("Toplu Silme", `${selectedFavs.length} adet favoriyi silmek istiyor musun?`, [
      { text: "İptal", style: "cancel" },
      { text: "Sil", style: "destructive", onPress: () => {
          setFavorites(favorites.filter(f => !selectedFavs.includes(f.id)));
          setSelectedFavs([]);
          setIsFavSelectMode(false);
      }}
    ]);
  };

  const displayFavorites = [...favorites].sort((a, b) => {
    if (a.completed === b.completed) return b.timestamp - a.timestamp;
    return a.completed ? 1 : -1;
  });
  // ------------------------------------

  const updateDraftName = (id, newName) => { setDrafts(drafts.map(d => d.id === id ? { ...d, name: newName } : d)); };

  const confirmDeleteDraft = (draft) => {
    Alert.alert("Taslağı Sil", "Bu taslağı gerçekten silmek istiyor musun?", [
      { text: "İptal", style: "cancel" },
      { text: "Sil", style: "destructive", onPress: () => executeDelete(draft) }
    ]);
  };

  const executeDelete = (draft) => {
    const index = drafts.findIndex(d => d.id === draft.id);
    setDrafts(drafts.filter(d => d.id !== draft.id));
    setDeletedDraftInfo({ draft, index });
    setTimeout(() => { setDeletedDraftInfo(null); }, 4000);
  };

  const undoDraftDelete = () => {
    if (deletedDraftInfo) {
      const newDrafts = [...drafts];
      newDrafts.splice(deletedDraftInfo.index, 0, deletedDraftInfo.draft);
      setDrafts(newDrafts);
      setDeletedDraftInfo(null);
    }
  };

  const toggleDraftSelection = (id) => {
    if (selectedDrafts.includes(id)) setSelectedDrafts(selectedDrafts.filter(draftId => draftId !== id));
    else setSelectedDrafts([...selectedDrafts, id]);
  };

  const bulkDelete = () => {
    if (selectedDrafts.length === 0) return;
    Alert.alert("Toplu Silme", `${selectedDrafts.length} adet taslağı silmek istiyor musun?`, [
      { text: "İptal", style: "cancel" },
      { text: "Sil", style: "destructive", onPress: () => {
          setDrafts(drafts.filter(d => !selectedDrafts.includes(d.id)));
          setSelectedDrafts([]);
          setIsSelectMode(false);
          setDeletedDraftInfo(null);
      }}
    ]);
  };

  const calcDistance = (touches) => {
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };
  const calcAngle = (touches) => {
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return (Math.atan2(dy, dx) * 180) / Math.PI;
  };

  const zoomPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (e, gestureState) => {
        let newZoom = zoomRef.current - (gestureState.dy / 170); 
        newZoom = Math.max(0, Math.min(1, newZoom));
        setCameraZoom(newZoom);
      },
      onPanResponderRelease: (e, gestureState) => {
        let newZoom = zoomRef.current - (gestureState.dy / 170);
        zoomRef.current = Math.max(0, Math.min(1, newZoom));
      }
    })
  ).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        if (isLockedRef.current) return;
        saveToHistory(); 
        const touches = e.nativeEvent.touches;
        prevTouches.current = touches.length;
        if (touches.length >= 2) {
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          initialDist.current = Math.sqrt(dx * dx + dy * dy);
          initialAngle.current = (Math.atan2(dy, dx) * 180) / Math.PI;
          startScale.current = scaleRef.current;
          startRotate.current = rotateRef.current;
        } else {
          pan.setOffset({ x: panRef.current.x, y: panRef.current.y });
          pan.setValue({ x: 0, y: 0 });
        }
      },
      onPanResponderMove: (e, gestureState) => {
        if (isLockedRef.current) return;
        const touches = e.nativeEvent.touches;
        if (prevTouches.current < 2 && touches.length >= 2) {
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          initialDist.current = Math.sqrt(dx * dx + dy * dy);
          initialAngle.current = (Math.atan2(dy, dx) * 180) / Math.PI;
          startScale.current = scaleRef.current;
          startRotate.current = rotateRef.current;
        } else if (prevTouches.current >= 2 && touches.length === 1) {
          pan.setOffset({ x: panRef.current.x, y: panRef.current.y });
          pan.setValue({ x: 0, y: 0 });
        }
        prevTouches.current = touches.length;
        if (touches.length >= 2) {
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          const currentDist = Math.sqrt(dx * dx + dy * dy);
          const currentAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
          scale.setValue(Math.max(0.1, startScale.current * (currentDist / initialDist.current)));
          rotate.setValue(startRotate.current + (currentAngle - initialAngle.current));
        } else if (touches.length === 1) {
          pan.setValue({ x: gestureState.dx, y: gestureState.dy });
        }
      },
      onPanResponderRelease: (e, gestureState) => {
        if (isLockedRef.current) return;
        if (Math.abs(gestureState.dx) < 5 && Math.abs(gestureState.dy) < 5) {
          const x = e.nativeEvent.changedTouches[0].pageX;
          const y = e.nativeEvent.changedTouches[0].pageY;
          focusX.setValue(x - 30); focusY.setValue(y - 30); focusOpacity.setValue(1);
          Animated.timing(focusOpacity, { toValue: 0, duration: 800, delay: 1500, useNativeDriver: true }).start();
        }
        prevTouches.current = 0;
        pan.flattenOffset();
      }
    })
  ).current;

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 1 });
    if (!result.canceled) {
      setImage(result.assets[0].uri);
      setCurrentScreen('editor');
      setCameraZoom(0);
      zoomRef.current = 0;
      historyRef.current = []; pan.setOffset({ x: 0, y: 0 }); pan.setValue({ x: 0, y: 0 }); scale.setValue(1); rotate.setValue(0);
      setIsLocked(false); isLockedRef.current = false;
      setIsDrawerOpen(true); drawerAnim.setValue(0);
    }
  };

  const changeScale = (amount) => { saveToHistory(); scale.setValue(Math.max(0.1, scaleRef.current + amount)); };
  const changeRotate = (amount) => { saveToHistory(); rotate.setValue(rotateRef.current + amount); };
  const movePos = (dx, dy) => { saveToHistory(); pan.setOffset({ x: panRef.current.x + dx, y: panRef.current.y + dy }); pan.setValue({ x: 0, y: 0 }); pan.flattenOffset(); };

  // ==========================================
  // EKRAN 1: ANA MENÜ
  // ==========================================
  if (currentScreen === 'menu') {
    return (
      <View style={styles.menuContainer}>
        <Text style={styles.menuTitle}>Şablon Çizici</Text>
        <TouchableOpacity style={styles.menuBigBtn} onPress={pickImage}>
          <Ionicons name="image-outline" size={32} color="#FFF" />
          <Text style={styles.menuBigBtnText}>Galeriden Seç</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.menuBigBtn, { backgroundColor: '#FF9800' }]} onPress={() => setCurrentScreen('favorites')} activeOpacity={0.8}>
          <Ionicons name="star" size={32} color="#FFF" />
          <Text style={styles.menuBigBtnText}>Favoriler {favorites.length > 0 && `(${favorites.length})`}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuBigBtn, { backgroundColor: drafts.length > 0 ? '#4CAF50' : 'rgba(76, 175, 80, 0.3)' }]} onPress={() => drafts.length > 0 && setCurrentScreen('drafts')} activeOpacity={drafts.length > 0 ? 0.7 : 1}>
          <Ionicons name="folder-open-outline" size={32} color={drafts.length > 0 ? "#FFF" : "rgba(255,255,255,0.5)"} />
          <Text style={[styles.menuBigBtnText, { color: drafts.length > 0 ? "#FFF" : "rgba(255,255,255,0.5)" }]}>Taslaklar {drafts.length > 0 && `(${drafts.length})`}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ==========================================
  // EKRAN 2.1: FAVORİLER MENÜSÜ
  // ==========================================
  if (currentScreen === 'favorites') {
    return (
      <View style={styles.draftsContainer}>
        <View style={styles.draftsHeader}>
          <TouchableOpacity onPress={() => { setCurrentScreen('menu'); setIsFavSelectMode(false); setSelectedFavs([]); }}>
            <Ionicons name="arrow-back" size={28} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.draftsTitle}>Favori Arşivim</Text>
          <View style={{flexDirection: 'row', gap: 15}}>
             <TouchableOpacity onPress={pickAndSaveFavorites}>
              <Ionicons name="add-circle-outline" size={28} color="#FF9800" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setIsFavSelectMode(!isFavSelectMode); setSelectedFavs([]); }}>
              <Text style={[styles.draftsSelectText, {color: '#FF9800'}]}>{isFavSelectMode ? 'İptal' : 'Seç'}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <ScrollView style={{ flex: 1, padding: 15 }}>
          {favorites.length === 0 && <Text style={{color: '#888', textAlign: 'center', marginTop: 50}}>Henüz favori eklemediniz.</Text>}
          
          {displayFavorites.map((fav) => (
            <TouchableOpacity 
              key={fav.id} 
              style={[styles.draftCard, isFavSelectMode && selectedFavs.includes(fav.id) && styles.draftCardSelected, fav.completed && {opacity: 0.5}]} 
              activeOpacity={0.8} 
              onPress={() => { if (isFavSelectMode) toggleFavSelection(fav.id); else loadToEditor(fav.uri); }}
            >
              <Animated.Image source={{ uri: fav.uri }} style={styles.draftThumb} resizeMode="cover" />
              <View style={{ flex: 1 }}>
                <TextInput style={[styles.draftNameInput, fav.completed && {textDecorationLine: 'line-through'}]} value={fav.name} onChangeText={(text) => updateFavName(fav.id, text)} placeholder="Favori Adı" placeholderTextColor="#888" editable={!isFavSelectMode} />
              </View>
              
              {!isFavSelectMode && (
                <TouchableOpacity onPress={() => toggleFavCompleted(fav.id)} style={{ padding: 10 }}>
                  <Ionicons name={fav.completed ? "checkmark-circle" : "ellipse-outline"} size={28} color={fav.completed ? "#4CAF50" : "#888"} />
                </TouchableOpacity>
              )}

              {isFavSelectMode ? (
                <MaterialCommunityIcons name={selectedFavs.includes(fav.id) ? "checkbox-marked-circle" : "checkbox-blank-circle-outline"} size={28} color={selectedFavs.includes(fav.id) ? "#FF9800" : "#888"} />
              ) : (
                <TouchableOpacity onPress={() => confirmDeleteFav(fav)} style={{ padding: 10 }}><MaterialCommunityIcons name="delete-outline" size={26} color="#F44336" /></TouchableOpacity>
              )}
            </TouchableOpacity>
          ))}
          <View style={{ height: 100 }} />
        </ScrollView>
        {isFavSelectMode && selectedFavs.length > 0 && (<TouchableOpacity style={styles.bulkDeleteBtn} onPress={bulkDeleteFavs}><Text style={styles.bulkDeleteText}>Seçilenleri Sil ({selectedFavs.length})</Text></TouchableOpacity>)}
      </View>
    );
  }

  // ==========================================
  // EKRAN 2.2: TASLAKLAR
  // ==========================================
  if (currentScreen === 'drafts') {
    return (
      <View style={styles.draftsContainer}>
        <View style={styles.draftsHeader}><TouchableOpacity onPress={() => { setCurrentScreen('menu'); setIsSelectMode(false); setSelectedDrafts([]); }}><Ionicons name="arrow-back" size={28} color="#FFF" /></TouchableOpacity><Text style={styles.draftsTitle}>Taslaklarım</Text><TouchableOpacity onPress={() => { setIsSelectMode(!isSelectMode); setSelectedDrafts([]); }}><Text style={styles.draftsSelectText}>{isSelectMode ? 'İptal' : 'Seç'}</Text></TouchableOpacity></View>
        <ScrollView style={{ flex: 1, padding: 15 }}>
          {drafts.map((draft) => (
            <TouchableOpacity key={draft.id} style={[styles.draftCard, isSelectMode && selectedDrafts.includes(draft.id) && styles.draftCardSelected]} activeOpacity={0.8} onPress={() => { if (isSelectMode) toggleDraftSelection(draft.id); else loadDraft(draft); }}><Animated.Image source={{ uri: draft.uri }} style={styles.draftThumb} resizeMode="cover" /><View style={{ flex: 1 }}><TextInput style={styles.draftNameInput} value={draft.name} onChangeText={(text) => updateDraftName(draft.id, text)} placeholder="Taslak Adı" placeholderTextColor="#888" editable={!isSelectMode} /></View>
              {isSelectMode ? (<MaterialCommunityIcons name={selectedDrafts.includes(draft.id) ? "checkbox-marked-circle" : "checkbox-blank-circle-outline"} size={28} color={selectedDrafts.includes(draft.id) ? "#4CAF50" : "#888"} />) : (<TouchableOpacity onPress={() => confirmDeleteDraft(draft)} style={{ padding: 10 }}><MaterialCommunityIcons name="delete-outline" size={26} color="#F44336" /></TouchableOpacity>)}
            </TouchableOpacity>
          ))}
          <View style={{ height: 100 }} />
        </ScrollView>
        {isSelectMode && selectedDrafts.length > 0 && (<TouchableOpacity style={styles.bulkDeleteBtn} onPress={bulkDelete}><Text style={styles.bulkDeleteText}>Seçilenleri Sil ({selectedDrafts.length})</Text></TouchableOpacity>)}
        {deletedDraftInfo && (<View style={styles.toastContainer}><Text style={styles.toastText}>Taslak silindi</Text><TouchableOpacity onPress={undoDraftDelete}><Text style={styles.toastUndoText}>[Geri Al]</Text></TouchableOpacity></View>)}
      </View>
    );
  }

  if (!permission || !permission.granted) return <View style={styles.center}><Text style={styles.text}>İzin Gerekli.</Text><TouchableOpacity style={styles.btnMain} onPress={requestPermission}><Text style={styles.btnText}>İzin Ver</Text></TouchableOpacity></View>;

  const spin = rotate.interpolate({ inputRange: [-3600, 3600], outputRange: ['-3600deg', '3600deg'] });
  const showUI = !isLocked;

  return (
    <View style={styles.container}>
      {isCameraActive ? (<CameraView style={StyleSheet.absoluteFillObject} facing="back" enableTorch={isFlashOn} zoom={cameraZoom} autofocus="on" />) : (<View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#111' }]} />)}
      <Animated.View pointerEvents="none" style={[styles.focusBox, { opacity: focusOpacity, transform: [{ translateX: focusX }, { translateY: focusY }] }]} />

      <View style={styles.topBarContainer} pointerEvents="box-none">
        {showUI && (
          <View style={styles.leftGroup}>
            <TouchableOpacity style={styles.iconActionBtn} onPress={() => setCurrentScreen('menu')}><Ionicons name="home-outline" size={26} color="#FFF" /></TouchableOpacity>
            <TouchableOpacity style={styles.iconActionBtn} onPress={pickImage}><Ionicons name="image-outline" size={26} color="#FFF" /></TouchableOpacity>
            {isCameraActive && (<TouchableOpacity style={[styles.iconActionBtn, isFlashOn && styles.btnActive]} onPress={() => setIsFlashOn(!isFlashOn)}><MaterialCommunityIcons name={isFlashOn ? "flashlight" : "flashlight-off"} size={26} color="#FFF" /></TouchableOpacity>)}
            <TouchableOpacity style={styles.saveDraftBtn} onPress={saveDraft}><MaterialCommunityIcons name="content-save" size={18} color="#FFF" /><Text style={styles.saveDraftText}>Taslağı Kaydet</Text></TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.leftVerticalContainer} pointerEvents="box-none">
        
        <TouchableOpacity style={styles.iconActionBtn} onPress={handleLockToggle}>
          <MaterialCommunityIcons name={isLocked ? "lock" : "lock-open-outline"} size={26} color="#FFF" />
        </TouchableOpacity>

        {showUI && (
          <TouchableOpacity style={styles.iconActionBtn} onPress={() => setIsCameraActive(!isCameraActive)}>
            <Ionicons name={isCameraActive ? "camera" : "camera-reverse"} size={26} color="#FFF" />
          </TouchableOpacity>
        )}

        {showUI && isCameraActive && (
          <View style={styles.zoomContainer}>
            <Text style={styles.zoomText}>{(1 + cameraZoom * 4).toFixed(1)}x</Text>
            <View style={styles.sliderWrapper} {...zoomPanResponder.panHandlers}>
              <View style={styles.sliderTrack}>
                <View style={[styles.sliderThumb, { bottom: `${cameraZoom * 100}%` }]} pointerEvents="none">
                  <View style={styles.thumbInner} />
                </View>
              </View>
            </View>
          </View>
        )}
      </View>

      <View style={styles.touchArea} {...panResponder.panHandlers}>{image && (<Animated.Image source={{ uri: image }} style={[styles.overlayImage, { opacity: opacity }, { transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale: scale }, { rotate: spin }] }]} resizeMode="contain" />)}</View>

      {image && showUI && (
        <>
          <Animated.View style={[styles.floatingToggleWrapper, { transform: [{ translateY: toggleTranslateY }] }]}>
            <Animated.View style={[styles.floatingToggleBtn, { borderBottomLeftRadius: toggleRadius, borderBottomRightRadius: toggleRadius, borderBottomWidth: toggleBorder }]}>
              <TouchableOpacity style={styles.toggleTouchArea} onPress={toggleDrawer} activeOpacity={0.8}><FontAwesome name={isDrawerOpen ? "chevron-down" : "chevron-up"} size={18} color="#FFF" /></TouchableOpacity>
            </Animated.View>
          </Animated.View>

          <Animated.View style={[styles.drawerContainer, { transform: [{ translateY: menuTranslateY }] }]}>
            <View style={styles.modernBottomBar}>
              
              <View style={styles.leftControls}>
                <View style={styles.modernControlGroup}>
                  <TouchableOpacity style={styles.modernBtn} onPress={() => setOpacity(Math.max(0.1, opacity - 0.1))}><Ionicons name="eye-outline" size={20} color="#BBB" /><FontAwesome name="minus" size={10} color="#888" style={{position:'absolute', bottom:2, right:3}} /></TouchableOpacity>
                  <TouchableOpacity style={styles.modernBtn} onPress={() => setOpacity(Math.min(1, opacity + 0.1))}><Ionicons name="eye-outline" size={20} color="#BBB" /><FontAwesome name="plus" size={10} color="#888" style={{position:'absolute', bottom:2, right:3}} /></TouchableOpacity>
                </View>
                
                <View style={styles.modernControlGroup}>
                  <TouchableOpacity style={styles.modernBtn} onPress={() => changeScale(-0.1)}><MaterialCommunityIcons name="arrow-collapse" size={22} color="#BBB" /></TouchableOpacity>
                  <TouchableOpacity style={styles.modernBtn} onPress={() => changeScale(0.1)}><MaterialCommunityIcons name="arrow-expand" size={22} color="#BBB" /></TouchableOpacity>
                </View>

                <View style={styles.modernControlGroup}>
                  <TouchableOpacity style={styles.modernBtn} onPress={handleUndo}><MaterialCommunityIcons name="undo" size={22} color="#BBB" /></TouchableOpacity>
                  <TouchableOpacity style={styles.modernBtn} onPress={handleReset}><MaterialCommunityIcons name="refresh" size={22} color="#BBB" /></TouchableOpacity>
                </View>

                <View style={styles.modernControlGroup}>
                  <TouchableOpacity style={styles.modernBtn} onPress={() => changeRotate(-5)}><MaterialCommunityIcons name="rotate-left" size={22} color="#BBB" /></TouchableOpacity>
                  <TouchableOpacity style={styles.modernBtn} onPress={() => changeRotate(5)}><MaterialCommunityIcons name="rotate-right" size={22} color="#BBB" /></TouchableOpacity>
                </View>
              </View>

              <View style={styles.dPadGroup}>
                <View style={styles.row}><TouchableOpacity style={styles.dPadBtn} onPress={() => movePos(0, -10)}><FontAwesome name="caret-up" size={20} color="#BBB" /></TouchableOpacity></View>
                <View style={styles.row}>
                  <TouchableOpacity style={styles.dPadBtn} onPress={() => movePos(-10, 0)}><FontAwesome name="caret-left" size={20} color="#BBB" /></TouchableOpacity>
                  <View style={{width: 32}} /> 
                  <TouchableOpacity style={styles.dPadBtn} onPress={() => movePos(10, 0)}><FontAwesome name="caret-right" size={20} color="#BBB" /></TouchableOpacity>
                </View>
                <View style={styles.row}><TouchableOpacity style={styles.dPadBtn} onPress={() => movePos(0, 10)}><FontAwesome name="caret-down" size={20} color="#BBB" /></TouchableOpacity></View>
              </View>

            </View>
          </Animated.View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  menuContainer: { flex: 1, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  menuTitle: { color: 'white', fontSize: 32, fontWeight: 'bold', marginBottom: 40 },
  menuBigBtn: { flexDirection: 'row', backgroundColor: '#2196F3', padding: 20, borderRadius: 20, alignItems: 'center', gap: 15, width: '80%', marginBottom: 20 },
  menuBigBtnText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  draftsContainer: { flex: 1, backgroundColor: '#111' },
  draftsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 20, backgroundColor: '#222' },
  draftsTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  draftsSelectText: { color: '#2196F3', fontSize: 16 },
  draftCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#222', padding: 10, borderRadius: 15, marginBottom: 10 },
  draftCardSelected: { borderColor: '#FF9800', borderWidth: 1, backgroundColor: 'rgba(255, 152, 0, 0.1)' },
  draftThumb: { width: 50, height: 50, borderRadius: 8, marginRight: 15 },
  draftNameInput: { color: 'white', fontSize: 16, flex: 1 },
  bulkDeleteBtn: { position: 'absolute', bottom: 30, left: 30, right: 30, backgroundColor: '#F44336', padding: 15, borderRadius: 15, alignItems: 'center' },
  bulkDeleteText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  toastContainer: { position: 'absolute', bottom: 100, alignSelf: 'center', backgroundColor: '#333', flexDirection: 'row', padding: 12, borderRadius: 25 },
  toastText: { color: 'white', marginRight: 10 },
  toastUndoText: { color: '#4CAF50', fontWeight: 'bold' },
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  touchArea: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', zIndex: 5 },
  overlayImage: { ...StyleSheet.absoluteFillObject },
  focusBox: { position: 'absolute', width: 60, height: 60, borderWidth: 1.5, borderColor: '#FFEB3B', borderRadius: 10, zIndex: 100 },
  
  topBarContainer: { position: 'absolute', top: 50, left: 15, right: 15, flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', zIndex: 10 },
  leftGroup: { flexDirection: 'row', gap: 10, alignItems: 'center' },

  leftVerticalContainer: { position: 'absolute', top: 110, left: 15, width: 50, alignItems: 'center', gap: 10, zIndex: 40 },

  zoomContainer: { width: 30, alignItems: 'center', marginTop: 5 },
  zoomText: { 
    color: 'white', 
    fontSize: 11, 
    fontWeight: 'bold', 
    marginBottom: 8, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    paddingHorizontal: 6, 
    paddingVertical: 2,   
    borderRadius: 5, 
    textAlign: 'center',
    overflow: 'hidden'    
  },
  sliderWrapper: { height: 200, width: 30, backgroundColor: 'rgba(30,30,30,0.6)', borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  sliderTrack: { width: 2, height: 170, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 1, alignItems: 'center' },
  sliderThumb: { position: 'absolute', width: 22, height: 22, backgroundColor: '#FFF', borderRadius: 11, elevation: 5, transform: [{translateY: 11}], justifyContent: 'center', alignItems: 'center' },
  thumbInner: { width: 10, height: 2, backgroundColor: '#888' },

  iconActionBtn: { width: 46, height: 46, backgroundColor: 'rgba(35,35,35,0.9)', borderRadius: 23, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  btnActive: { backgroundColor: 'rgba(255, 152, 0, 0.9)', borderWidth: 1, borderColor: '#FFF' },
  saveDraftBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(95, 115, 100, 0.95)', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 20, gap: 4, elevation: 5 },
  saveDraftText: { color: 'white', fontWeight: 'bold', fontSize: 12 },

  drawerContainer: { position: 'absolute', bottom: 20, left: 10, right: 10, height: 130, zIndex: 10 },
  floatingToggleWrapper: { position: 'absolute', bottom: 149, alignSelf: 'center', zIndex: 11, width: 70, height: 40 },
  floatingToggleBtn: { flex: 1, backgroundColor: 'rgba(25,25,25,0.95)', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderColor: '#333', borderBottomColor: 'rgba(25,25,25,0.95)' },
  toggleTouchArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  modernBottomBar: { flex: 1, backgroundColor: 'rgba(25,25,25,0.95)', padding: 12, borderRadius: 25, elevation: 10, borderWidth: 1, borderColor: '#333', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  
  leftControls: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginRight: 10 },
  modernControlGroup: { flexDirection: 'row', backgroundColor: '#333', borderRadius: 15, padding: 5, gap: 5 },
  modernBtn: { width: 42, height: 42, justifyContent: 'center', alignItems: 'center', backgroundColor: '#444', borderRadius: 12 },
  
  dPadGroup: { backgroundColor: '#333', borderRadius: 15, padding: 8, alignItems: 'center' },
  dPadBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center', backgroundColor: '#444', borderRadius: 8 },
  row: { flexDirection: 'row', gap: 5 },
  btnMain: { backgroundColor: '#4CAF50', padding: 15, borderRadius: 10 },
  btnText: { color: 'white', fontWeight: 'bold' }
});