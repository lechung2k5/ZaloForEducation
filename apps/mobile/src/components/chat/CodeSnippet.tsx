import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Alert from '../../utils/Alert';
import { Colors } from '../../constants/Theme';

interface CodeSnippetProps {
  code: string;
  language?: string;
  filename?: string;
}

export default function CodeSnippet({ code, language = 'text', filename }: CodeSnippetProps) {
  const handleCopy = async () => {
    await Clipboard.setStringAsync(code);
    Alert.alert('Đã sao chép', 'Đoạn mã đã được sao chép vào bộ nhớ tạm.');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.filename}>{filename || language}</Text>
        <TouchableOpacity style={styles.copyButton} onPress={handleCopy}>
          <Text style={styles.copyIcon}>content_copy</Text>
          <Text style={styles.copyText}>Sao chép</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.codeContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Text style={styles.codeText} selectable>
            {code}
          </Text>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    backgroundColor: '#f8f9fa',
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#e9ecef',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  filename: {
    fontSize: 11,
    fontWeight: '700',
    color: '#495057',
    textTransform: 'uppercase',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#dee2e6',
    borderRadius: 6,
  },
  copyIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 14,
    color: '#495057',
  },
  copyText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#495057',
  },
  codeContainer: {
    padding: 12,
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    color: '#333',
    lineHeight: 18,
  }
});
