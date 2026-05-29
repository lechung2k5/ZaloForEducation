import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    SafeAreaView,
    ScrollView,
    ActivityIndicator,
    Modal,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Shadows, Typography } from '../../constants/Theme';
import { useTheme } from '../../context/ThemeContext';
import { apiRequest } from '../../utils/api';
import Alert from '../../utils/Alert';
import { useAuth } from '../../context/AuthContext';
import { useOtpCountdown } from '../../hooks/useOtpCountdown';

interface ChangePasswordProps {
    onNavigate: (screen: string, params?: any) => void;
    goBack: () => void;
}

export default function ChangePasswordScreen({ onNavigate, goBack }: ChangePasswordProps) {
  const { colors, t, isDark } = useTheme();
  const styles = React.useMemo(() => getStyles(colors, isDark), [colors, isDark]);
    const { logout, user } = useAuth() as any;
    const [step, setStep] = useState(1); // 1: Passwords, 2: OTP
    const [loading, setLoading] = useState(false);
    const { countdown, startCountdown, syncWithServer } = useOtpCountdown(user?.email);

    // Form data
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [otp, setOtp] = useState('');

    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);

    const handleRequest = async () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            Alert.alert(t('common.error'), t('auth.pass_empty'));
            return;
        }

        if (newPassword !== confirmPassword) {
            Alert.alert(t('common.error'), t('auth.err_password_match'));
            return;
        }

        if (newPassword === currentPassword) {
            Alert.alert(t('common.error'), t('auth.pass_same'));
            return;
        }

        setLoading(true);
        try {
            const res = await apiRequest('/auth/change-password/request', {
                method: 'POST',
                body: JSON.stringify({ currentPassword, newPassword })
            });
            startCountdown();
            Alert.alert(t('common.success'), res.message || t('auth.otp_sent'));
            setStep(2);
        } catch (err: any) {
            if (err.retryAfter) {
              syncWithServer(err.retryAfter);
            }
            Alert.alert(t('common.error'), err.message || t('auth.err_change_pass'));
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = async () => {
        if (otp.length < 6) {
            Alert.alert(t('common.error'), t('auth.err_otp_length'));
            return;
        }

        setLoading(true);
        try {
            const res = await apiRequest('/auth/change-password/confirm', {
                method: 'POST',
                body: JSON.stringify({ otp })
            });
            
            Alert.alert(
                'Thành công', 
                'Mật khẩu đã được thay đổi. Tất cả thiết bị đã được đăng xuất để bảo mật. Vui lòng đăng nhập lại.',
                [{ text: 'OK', onPress: () => logout() }]
            );
        } catch (err: any) {
            if (err.retryAfter) {
                syncWithServer(err.retryAfter);
            }
            Alert.alert(t('common.error'), err.message || t('auth.err_otp_verify'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <LinearGradient colors={['#0058bc', '#00418f']} style={styles.header}>
                <View style={styles.headerRow}>
                    <TouchableOpacity style={styles.backButton} onPress={goBack}>
                        <Text style={styles.headerIcon}>arrow_back</Text>
                    </TouchableOpacity>
                    <View style={styles.headerTitleWrap}>
                        <Text style={styles.headerTitle}>{t('auth.change_password')}</Text>
                        <Text style={styles.headerSubtitle}>{t('auth.verify_2fa')}</Text>
                    </View>
                </View>
            </LinearGradient>

            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    {step === 1 ? (
                        <View style={styles.formCard}>
                            <Text style={styles.instructions}>
                                {t('auth.change_pass_instructions')}<Text style={{fontWeight:'700'}}>{user?.email}</Text>
                            </Text>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>{t('auth.current_pass')}</Text>
                                <View style={styles.inputWrapper}>
                                    <Text style={styles.fieldIcon}>lock</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder={t('auth.current_pass')}
                                        secureTextEntry={!showCurrentPassword}
                                        value={currentPassword}
                                        onChangeText={setCurrentPassword}
                                    />
                                    <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)}>
                                        <Text style={styles.eyeIcon}>{showCurrentPassword ? 'visibility_off' : 'visibility'}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>{t('auth.new_pass')}</Text>
                                <View style={styles.inputWrapper}>
                                    <Text style={styles.fieldIcon}>password</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder={t('auth.new_pass')}
                                        secureTextEntry={!showNewPassword}
                                        value={newPassword}
                                        onChangeText={setNewPassword}
                                    />
                                    <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
                                        <Text style={styles.eyeIcon}>{showNewPassword ? 'visibility_off' : 'visibility'}</Text>
                                    </TouchableOpacity>
                                </View>
                                <Text style={styles.hint}>{t('auth.new_pass_hint')}</Text>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>{t('auth.confirm_password')}</Text>
                                <View style={styles.inputWrapper}>
                                    <Text style={styles.fieldIcon}>check_circle</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder={t('auth.confirm_password')}
                                        secureTextEntry={!showNewPassword}
                                        value={confirmPassword}
                                        onChangeText={setConfirmPassword}
                                    />
                                </View>
                            </View>

                            <TouchableOpacity 
                                style={[styles.submitButton, loading && styles.disabledButton]} 
                                onPress={handleRequest}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.submitText}>{t('common.continue')}</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.formCard}>
                            <View style={styles.otpHeader}>
                                <View style={styles.otpIconBadge}>
                                    <Text style={styles.otpIcon}>mark_email_unread</Text>
                                </View>
                                <Text style={styles.otpTitle}>{t('auth.enter_otp_title')}</Text>
                                <Text style={styles.otpSubtitle}>{t('auth.enter_otp_subtitle')}</Text>
                            </View>

                            <View style={styles.otpInputWrapper}>
                                <TextInput
                                    style={styles.otpInput}
                                    placeholder="000000"
                                    keyboardType="number-pad"
                                    maxLength={6}
                                    value={otp}
                                    onChangeText={setOtp}
                                    autoFocus
                                />
                            </View>

                            <TouchableOpacity 
                                style={[styles.submitButton, (loading || (step === 1 && countdown > 0)) && styles.disabledButton]} 
                                onPress={step === 1 ? handleRequest : handleConfirm}
                                disabled={loading || (step === 1 && countdown > 0)}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.submitText}>
                                        {step === 1 ? (countdown > 0 ? t('common.continue') + ' (' + countdown + 's)' : t('common.continue')) : t('auth.confirm_change')}
                                    </Text>
                                )}
                            </TouchableOpacity>

                            {step === 2 && (
                                <TouchableOpacity 
                                    style={styles.resendBtn} 
                                    onPress={handleRequest}
                                    disabled={countdown > 0 || loading}
                                >
                                    <Text style={[styles.resendText, (countdown > 0 || loading) && { color: colors.outline, textDecorationLine: 'none' }]}>
                                        {countdown > 0 ? t('auth.resend_code') + ' (' + countdown + 's)' : t('auth.resend_otp')}
                                    </Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity style={styles.resendBtn} onPress={() => setStep(1)}>
                                <Text style={styles.resendText}>{t('auth.back_to_pass')}</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        paddingTop: Platform.OS === 'android' ? 40 : 10,
        paddingBottom: 20,
        paddingHorizontal: 16,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerIcon: {
        fontFamily: 'Material Symbols Outlined',
        fontSize: 24,
        color: '#fff',
    },
    headerTitleWrap: {
        flex: 1,
    },
    headerTitle: {
        ...Typography.heading,
        color: '#fff',
        fontSize: 20,
    },
    headerSubtitle: {
        ...Typography.body,
        color: 'rgba(255,255,255,0.8)',
        fontSize: 12,
        marginTop: 2,
    },
    scrollContent: {
        padding: 20,
    },
    formCard: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 24,
        ...Shadows.soft,
    },
    instructions: {
        ...Typography.body,
        fontSize: 14,
        color: colors.onSurfaceVariant,
        lineHeight: 20,
        marginBottom: 24,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        ...Typography.body,
        fontWeight: '700',
        fontSize: 14,
        color: colors.onSurface,
        marginBottom: 8,
        marginLeft: 4,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f5f7fa',
        borderRadius: 16,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: '#edf0f5',
    },
    fieldIcon: {
        fontFamily: 'Material Symbols Outlined',
        fontSize: 20,
        color: colors.primary,
        marginRight: 10,
    },
    input: {
        flex: 1,
        height: 52,
        ...Typography.body,
        fontSize: 15,
        color: colors.onSurface,
    },
    eyeIcon: {
        fontFamily: 'Material Symbols Outlined',
        fontSize: 20,
        color: colors.onSurfaceVariant,
        padding: 8,
    },
    hint: {
        fontSize: 11,
        color: colors.onSurfaceVariant,
        marginTop: 6,
        marginLeft: 4,
        fontStyle: 'italic',
    },
    submitButton: {
        backgroundColor: colors.primary,
        height: 56,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
    },
    submitText: {
        ...Typography.heading,
        color: '#fff',
        fontSize: 16,
    },
    disabledButton: {
        opacity: 0.6,
    },
    otpHeader: {
        alignItems: 'center',
        marginBottom: 24,
    },
    otpIconBadge: {
        width: 64,
        height: 64,
        borderRadius: 22,
        backgroundColor: '#eef4ff',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    otpIcon: {
        fontFamily: 'Material Symbols Outlined',
        fontSize: 32,
        color: colors.primary,
    },
    otpTitle: {
        ...Typography.heading,
        fontSize: 18,
        color: colors.onSurface,
    },
    otpSubtitle: {
        ...Typography.body,
        fontSize: 14,
        color: colors.onSurfaceVariant,
        textAlign: 'center',
        marginTop: 8,
    },
    otpInputWrapper: {
        alignItems: 'center',
        marginBottom: 32,
    },
    otpInput: {
        fontSize: 36,
        fontWeight: '800',
        color: colors.primary,
        letterSpacing: 10,
        textAlign: 'center',
        width: '100%',
        backgroundColor: '#f5f7fa',
        paddingVertical: 12,
        borderRadius: 16,
    },
    resendBtn: {
        alignItems: 'center',
        marginTop: 20,
    },
    resendText: {
        ...Typography.body,
        color: colors.primary,
        fontWeight: '700',
        fontSize: 14,
    }
});

