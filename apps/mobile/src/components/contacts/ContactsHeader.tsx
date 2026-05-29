import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getContactsStyles } from '../../screens/main/style/ContactsScreen.styles';

interface ContactsHeaderProps {
  insets: { top: number };
  searchText: string;
  setSearchText: (text: string) => void;
  onAddPress: () => void;
}

export const ContactsHeader: React.FC<ContactsHeaderProps> = ({
  insets,
  searchText,
  setSearchText,
  onAddPress,
}) => {
  const { colors } = useTheme();
  const styles = getContactsStyles(colors);
  return (
    <LinearGradient
      colors={["#0058bc", "#00418f"]}
      style={[styles.header, { paddingTop: insets.top + 10 }]}
    >
      <View style={styles.searchBarWrap}>
        <Text style={styles.headerIcon}>search</Text>
        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Tìm kiếm"
          placeholderTextColor="rgba(255,255,255,0.8)"
          style={styles.headerSearchInput}
        />
      </View>
      <TouchableOpacity
        style={styles.headerAction}
        onPress={onAddPress}
      >
        <Text style={styles.headerActionIcon}>person_add</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
};
