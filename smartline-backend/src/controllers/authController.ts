import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { ReferralService } from '../services/referralService';
import { assertOtpVerified } from './otpController';

export const checkPhone = async (req: Request, res: Response) => {
    const { phone } = req.body;

    try {
        const { data, error } = await supabase
            .from('users')
            .select('id')
            .eq('phone', phone)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
            throw error;
        }

        if (data) {
            res.json({ exists: true });
        } else {
            res.json({ exists: false });
        }
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const signup = async (req: Request, res: Response) => {
    const { phone, password, role, name, email, referralCode } = req.body;

    try {
        // 0. Verify OTP was completed for this phone
        const otpOk = await assertOtpVerified(phone);
        if (!otpOk) {
            return res.status(400).json({ error: 'OTP_REQUIRED', message: 'Phone must be verified before signup' });
        }

        // 1. Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 2. Insert into DB
        const { data, error } = await supabase
            .from('users')
            .insert({
                phone,
                password_hash: hashedPassword,
                role: role || 'customer',
                full_name: name,
                email: email
            })
            .select()
            .single();

        if (error) {
            console.error('Supabase Insert Error:', error);
            throw error;
        }

        // 3. Generate Token
        const token = jwt.sign({ id: data.id, role: data.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });

        // 4. Apply Referral if provided
        if (referralCode) {
            try {
                await ReferralService.applyReferral(data.id, referralCode, 'signup');
            } catch (refError) {
                console.warn('Referral application failed during signup:', refError);
            }
        }

        res.status(201).json({ user: data, token });
    } catch (error: any) {
        console.error('Signup Error:', error);
        // Return more detailed error for debugging
        const errorMessage = error.message || 'Signup failed';
        const errorDetails = error.details || error.hint || '';
        res.status(400).json({
            error: errorMessage,
            details: errorDetails
        });
    }
};

export const login = async (req: Request, res: Response) => {
    const { phone, password } = req.body;

    try {
        // 1. Find User
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('phone', phone)
            .single();

        if (!user || error) {
            return res.status(404).json({ error: 'User not found' });
        }

        // 2. Check Password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // 3. Generate Token
        const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });

        res.json({ user, token });

    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const resetPassword = async (req: Request, res: Response) => {
    const { phone, newPassword } = req.body;

    try {
        // 0. Verify OTP was completed for this phone
        const otpOk = await assertOtpVerified(phone);
        if (!otpOk) {
            return res.status(400).json({ error: 'OTP_REQUIRED', message: 'Phone must be verified before resetting password' });
        }

        // 1. Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // 2. Update User
        const { data, error } = await supabase
            .from('users')
            .update({ password_hash: hashedPassword })
            .eq('phone', phone)
            .select();

        if (error) throw error;

        if (!data || data.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'Password updated successfully' });

    } catch (error: any) {
        console.error('Reset Password Error:', error);
        res.status(500).json({ error: error.message });
    }
};
