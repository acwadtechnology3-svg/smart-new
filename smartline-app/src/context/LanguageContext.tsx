import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager } from 'react-native';

type Language = 'en' | 'ar';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => Promise<void>;
    isRTL: boolean;
    t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
    language: 'ar',
    setLanguage: async () => { },
    isRTL: true,
    t: (key) => key,
});

export const translations = {
    en: {
        // Sidebar & Menu
        wallet: 'Wallet',
        tripHistory: 'Trip History',
        activeTravel: 'Active Travel',
        earnings: 'Earnings',
        myVehicle: 'My Vehicle',
        support: 'Support',
        settings: 'Settings',
        signOut: 'Sign Out',
        viewProfile: 'View Profile',
        driver: 'Driver',
        language: 'Language',
        english: 'English',
        arabic: 'Arabic',
        switchLanguage: 'Switch Language',
        selectLanguage: 'Select Application Language',

        // Safety & Emergency
        safetyEmergency: 'Safety & Emergency',
        callEmergency: 'Call Emergency (122)',
        reportIncident: 'Report Incident',
        shareLocation: 'Share Live Location',
        cancel: 'Cancel',
        sendSOS: 'Send SOS Alert',
        sosSent: 'SOS Sent!',
        sosMessage: 'Help is on the way. Our emergency team has been notified of your location.',

        // Home Screen
        goOnline: 'GO ONLINE',
        goOffline: 'GO OFFLINE',
        findingTrips: 'Finding Trips...',
        accessBlocked: 'Access Blocked',
        balanceLow: 'Your wallet balance is below -100 EGP. Please deposit to continue receiving trips.',
        goToWallet: 'Go to Wallet',
        videoCall: 'Video Call',

        // Wallet
        currentBalance: 'Current Balance',
        deposit: 'Deposit',
        withdraw: 'Withdraw',
        amount: 'Amount',
        method: 'Method',
        accountNumber: 'Account Number',
        recentTransactions: 'Recent Transactions',
        noTransactions: 'No transactions yet',

        // History
        myTrips: 'My Trips',
        tripId: 'Trip ID',
        date: 'Date',
        price: 'Price',
        status: 'Status',
        completed: 'Completed',
        cancelled: 'Cancelled',

        // Common
        error: 'Error',
        success: 'Success',
        ok: 'OK',
        loading: 'Loading',
        permissionDenied: 'Permission Denied',
        locationPermissionRequired: 'Location permission is required.',
        updateFailed: 'Failed to update settings',
        confirmLogout: 'Are you sure you want to log out?',
        account: 'Account',
        preferences: 'Preferences',
        genericError: 'Something went wrong. Please try again.',
        connectionError: 'Connection failed. Please check your internet.',

        // Delete Account
        deleteAccount: 'Delete Account',
        deleteAccountConfirm: 'This will permanently delete your account. All your data will be removed. Are you sure?',
        delete: 'Delete',
        accountDeleted: 'Your account has been deleted successfully.',
        deleteAccountFailed: 'Failed to delete account. Please try again.',

        newRequest: 'New Trip Request',
        accept: 'Accept',
        decline: 'Decline',
        bid: 'Bid',
        pickup: 'Pickup',
        dropoff: 'Dropoff',
        distance: 'Distance',
        estEarnings: 'Est. Earnings',

        // Earnings Screen
        totalBalance: 'Total Balance',
        availableWithdrawal: 'Available for withdrawal',
        today: 'Today',
        trips: 'Trips',
        hours: 'Hours',

        // My Vehicle Screen
        documentsStatus: 'Documents Status',
        driverLicense: 'Driver License',
        vehicleLicense: 'Vehicle License',
        nationalID: 'National ID',
        uploaded: 'Uploaded',
        missing: 'Missing',
        expires: 'Expires',
        uploadRequired: 'Upload Required',
        viewDocument: 'View Document',
        requestVehicleChange: 'Request Vehicle Change',
        vehicleChangePending: 'Vehicle Change Request Pending Approval',
        vehicleChangeRejected: 'Vehicle Change Rejected',
        loadingVehicleInfo: 'Loading vehicle info...',

        // Support Screen
        contactUs: 'Contact Us',
        callUs: 'Call Us',
        whatsapp: 'WhatsApp',
        myRequests: 'My Requests',
        newSupportRequest: 'New Request',
        startChat: 'Start Chat',
        whatIsYourIssue: 'What is your issue?',
        enterSubject: 'e.g. Payment Issue, App Bug...',
        noTickets: 'No support requests yet.',
        enterSubjectError: 'Please enter a subject',

        // Search Screen
        enterPickupLocation: 'Enter Pickup Location',
        searchingInEgypt: 'Searching in Egypt...',
        chooseOnMap: 'Choose on map',
        home: 'Home',
        work: 'Work',
        favorites: 'Favorites',

        // Change Vehicle
        changeVehicle: 'Change Vehicle',
        vehicleType: 'Vehicle Type',
        vehicleModel: 'Vehicle Model',
        vehiclePlate: 'Vehicle Plate',
        vehicle: 'Vehicle',
        licensePhotos: 'License Photos',
        vehiclePhotos: 'Vehicle Photos',
        licenseFront: 'License Front',
        licenseBack: 'License Back',
        front: 'Front',
        back: 'Back',
        rightSide: 'Right Side',
        leftSide: 'Left Side',
        submitRequest: 'Submit Request',
        fillVehicleInfo: 'Please fill in vehicle model and plate number.',
        uploadPending: 'Uploading...',
        car: 'Car',
        motorcycle: 'Motorcycle',
        taxi: 'Taxi',

        // Customer Home
        whereTo: 'Where to?',
        currentLocation: 'Current Location',
        locating: 'Locating...',
        searchDestination: 'Search destination',
        recentLocations: 'Recent Locations',
        clearAll: 'Clear All',
        noRecentLocations: 'No recent locations',
        safetyCenter: 'Safety Center',
        fetchingLocation: 'Fetching location...',
        exclusiveDiscounts: 'Exclusive discounts for you!',
        dailyDiscounts: "Don't miss out on your daily discounts",
        clickHere: 'click here',
        safestTrips: 'safest trips with SmartLine',
        enjoy: 'Enjoy',
        affordable: 'affordable',
        tripsWithUs: 'trips with us',

        // Trip Options
        chooseRide: 'Choose a ride',
        from: 'From',
        to: 'To',
        km: 'km',
        min: 'min',
        bestValue: 'Best Value',
        recommended: 'Recommended',
        premiumService: 'Premium Service',
        fastest: 'Fastest',
        select: 'Select',
        paymentMethod: 'Payment Method',
        cash: 'Cash',
        promoCode: 'Promo Code',
        apply: 'Apply',
        requestFailed: 'Request Failed',
        routeNotCalculated: 'Route not calculated yet',
        authError: 'Auth Error',
        pleaseLogin: 'Please log in again',

        // Searching Driver
        findingYourDriver: 'Finding your driver...',
        searchingNearby: 'Searching for nearby drivers',
        driverOffers: 'Driver Offers',
        acceptRide: 'Accept Ride',
        reject: 'Reject',
        offer: 'Offer',
        plate: 'Plate',
        rating: 'Rating',
        driverAlreadySelected: 'Driver Already Selected',
        tripAlreadyAccepted: 'This trip has already been accepted by another driver',
        viewDriver: 'View Driver',
        cancelTrip: 'Cancel Trip',
        cancelConfirm: 'Are you sure you want to cancel this trip request?',
        yesCancel: 'Yes, Cancel',
        noKeep: 'No, Keep',

        // Driver Found
        driverArriving: 'Driver Arriving',
        arrivingIn: 'Arriving in',
        minutes: 'minutes',
        call: 'Call',
        chat: 'Chat',
        share: 'Share',
        cancelSearch: 'Cancel Search',

        // On Trip
        tripInProgress: 'Trip in Progress',
        takingYouToDest: 'Your driver is taking you to your destination',
        pickupLocation: 'Pickup',
        destination: 'Destination',
        safety: 'Safety',
        cancelFeeWarning: 'A cancellation fee may apply',
        tripCancelledMsg: 'Trip has been cancelled',

        // Trip Complete
        tripCompleted: 'Trip Completed',
        thankYou: 'Thank you for riding with us',
        totalFare: 'Total Fare',
        payCash: 'Please pay cash to driver',
        rateDriver: 'Rate your driver',
        addTip: 'Add Tip (Optional)',
        done: 'Done',

        // Active Trip
        drivingToPickup: 'Driving to Pickup',
        atPickup: 'At Pickup Location',
        onTrip: 'On Trip',
        tripFinished: 'Trip Finished',
        tripCancelled: 'Trip Cancelled',
        passengerCancelled: 'The passenger has cancelled this trip.',
        arrivedAtPickup: 'ARRIVED AT PICKUP',
        startTrip: 'START TRIP',
        completeTrip: 'COMPLETE TRIP',
        refreshStatus: 'Refresh Status',
        payment: 'Payment',
        freeWaiting: 'Free Waiting Time',
        paidWaiting: 'Paid Waiting Time',
        // Role Selection
        welcomeTitle: 'Welcome to SmartLine',
        welcomeSubtitle: 'How would you like to use the app?',
        iNeedRide: 'I need a ride',
        bookRides: 'Book rides to your destination',
        iWantToDrive: 'I want to drive',
        earnMoney: 'Earn money on your schedule',
        changeRoleLater: 'You can change this later in settings',

        // Auth Flow
        enterPhoneNumber: 'Enter your phone number',
        weWillSendCode: "We'll send you a verification code",
        continue: 'Continue',
        verifyNumber: 'Verify your number',
        enterCodeSentTo: 'Enter the 4-digit code sent to',
        resendCode: 'Resend code',
        availableIn: 'Available in',
        verify: 'Verify',
        createAccount: 'Create your account',
        signUpAs: 'Sign up as a',
        fullName: 'Full Name',
        email: 'Email',
        password: 'Password',
        confirmPassword: 'Confirm Password',
        createAccountBtn: 'Create Account',
        enterPassword: 'Enter your password',
        welcomeBack: 'Welcome Back',
        login: 'Log In',
        pleaseFillAllFields: 'Please fill in all fields',
        passwordsDoNotMatch: 'Passwords do not match',
        signupFailed: 'Signup Failed. Please try again.',
        passenger: 'Passenger',
        enterPasswordFor: 'Enter password for',
        forgotPassword: 'Forgot password?',
        pleaseEnterPassword: 'Please enter your password',
        loginError: 'Login Error',
        loginFailed: 'Login Failed',
        accountNotDriver: 'This account is not registered as a Driver. Please sign up or login as Customer.',
        incorrectNumber: 'Phone number incorrect or not registered',
        incorrectPassword: 'Incorrect password',
        personalInfo: 'Personal Information',
        step: 'Step',
        of: 'of',
        nationalIdNumber: 'National ID Number',
        city: 'City',
        nextVehicleInfo: 'Next: Vehicle Info',
        nextProfilePhoto: 'Next: Profile Photo',
        nextDocuments: 'Next: Documents',
        profilePhoto: 'Profile Photo',
        uploadProfilePhoto: 'Upload Profile Photo',
        profilePhotoDescription: 'Please upload a clear photo of yourself. This will be shown to customers.',
        removePhoto: 'Remove Photo',
        resetPassword: 'Reset Password',
        newPassword: 'New Password',
        passwordResetSuccess: 'Password has been reset successfully.',
        securityLogin: 'Security & Login',
        notifications: 'Notifications',
        version: 'Version',
        // SideMenu
        editPersonalInfo: 'Edit Personal Info',
        messages: 'Messages',
        inviteFriends: 'Invite Friends',
        locationPreferences: 'Location Preferences',
        manageSavedLocations: 'Manage home, work, and favorites',
        setLocation: 'Set Location',
        updateLocation: 'Update',
        addFavorite: 'Add Favorite',
        noFavoritesSaved: 'No favorites saved yet.',
        homeLocationNotSet: 'Home location is not set.',
        workLocationNotSet: 'Work location is not set.',
        favoritesLimitReached: 'You reached the maximum favorites.',
        deleteLocationConfirm: 'Delete this saved location?',
        saveFailed: 'Failed to save location.',
        driveWithUs: 'Drive with Us',
        discounts: 'Discounts',
        scan: 'Scan',

        // Promos & Discounts
        checking: 'Checking...',
        promoApplied: 'Promo applied!',
        youWillGet: "You'll get",
        offNextRide: 'off your next ride.',
        bookNow: 'Book Now',
        invalidCode: 'Invalid Code',
        promoInvalid: 'This promo code is not valid.',
        enterPromoCode: 'Enter Promo Code',
        promoSubtitle: 'Have a discount code? Enter it below.',
        promoPlaceholder: 'e.g. SMART50',
        activePromotions: 'Active Promotions',
        availablePromotions: 'Available Promotions',
        noActivePromos: 'No active promotions at the moment.',
        validUntil: 'Valid until',
        noExpiry: 'No Expiry',
        use: 'USE',
        max: 'Max',
        off: 'OFF',
        applyCode: 'Apply Code',
        close: 'Close',
        selectPaymentMethod: 'Select Payment Method',
        rideSaver: 'Saver',
        rideComfort: 'Comfort',
        rideVIP: 'VIP',
        rideScooter: 'Scooter',
        rideTaxi: 'Taxi',
        currency: 'EGP',

        // Safety Screen Extra
        sendSosAlert: 'Send SOS Alert?',
        sosAlertDescription: 'This will instantly notify our Safety Team and share your live location and trip details.',
        sendAlert: 'SEND ALERT',
        detectingLocation: 'We cannot detect your location yet. Please wait a moment.',
        noActiveTrip: 'No Active Trip',
        noActiveTripDesc: "We couldn't find an active trip to attach this SOS alert.",
        sosSentDesc: 'Our team has been notified and is tracking your location. Stay calm.',
        failed: 'Failed',
        sosFailed: 'Could not send alert. Please call police directly.',
        safetyToolkit: 'Safety Toolkit',
        safetyToolkitDesc: 'Your safety is our top priority. Access these tools anytime during your trip.',
        emergencyAssistance: 'Emergency Assistance',
        sosEmergency: 'SOS Emergency Alert',
        sosEmergencySub: 'Instantly notify support team',
        callPolice: 'Call Police',
        callPoliceSub: 'Direct line to 122',
        promoCodes: 'Promo Codes',

        // Referral System
        haveReferralCode: 'Have a referral code?',
        referralCodePlaceholder: 'e.g. ABC1234',
        referralCodeHint: 'Enter a friend\'s referral code to earn rewards',
        referAndEarn: 'Refer & Earn',
        referralTitle: 'Give 50%, Get 50%',
        referralDescription: 'Invite your friends to use SmartLine. When they take their first trip, you both get a 50% discount!',
        yourReferralCode: 'YOUR REFERRAL CODE',
        copy: 'Copy',
        copied: 'Copied!',
        shareCode: 'Share Code',
        referralCodeCopied: 'Referral code copied to clipboard!',
        referrals: 'Referrals',
        totalEarnedRef: 'Earned',
    },
    ar: {
        // Sidebar & Menu
        wallet: 'المحفظة',
        tripHistory: 'سجل الرحلات',
        activeTravel: 'رحلة نشطة',
        earnings: 'الأرباح',
        myVehicle: 'عربيتي',
        support: 'المساعدة',
        settings: 'الإعدادات',
        signOut: 'خروج',
        viewProfile: 'الملف الشخصي',
        driver: 'سائق',
        language: 'اللغة',
        english: 'English',
        arabic: 'العربية',
        switchLanguage: 'تغيير اللغة',
        selectLanguage: 'اختر لغة التطبيق',

        // Safety & Emergency
        safetyEmergency: 'الطوارئ والأمان',
        callEmergency: 'اتصل بالطوارئ (122)',
        reportIncident: 'إبلاغ عن حادث',
        shareLocation: 'مشاركة الموقع المباشر',
        cancel: 'إلغاء',
        sendSOS: 'إرسال نداء استغاثة SOS',
        sosSent: 'تم إرسال الاستغاثة!',
        sosMessage: 'المساعدة في الطريق. تم إخطار فريق الطوارئ بموقعك.',

        // Home Screen
        goOnline: 'ابدأ العمل',
        goOffline: 'توقف عن العمل',
        findingTrips: 'جاري البحث عن رحلات...',
        accessBlocked: 'تم حظر الوصول',
        balanceLow: 'رصيد محفظتك أقل من -100 جنيه. يرجى الإيداع للمتابعة.',
        goToWallet: 'الذهاب للمحفظة',
        videoCall: 'مكالمة فيديو',

        // Wallet
        currentBalance: 'الرصيد الحالي',
        deposit: 'إيداع',
        withdraw: 'سحب',
        amount: 'المبلغ',
        method: 'الطريقة',
        accountNumber: 'رقم الحساب',
        recentTransactions: 'آخر المعاملات',
        noTransactions: 'لا يوجد معاملات حتى الآن',

        // History
        myTrips: 'رحلاتي',
        tripId: 'رقم الرحلة',
        date: 'التاريخ',
        price: 'السعر',
        status: 'الحالة',
        completed: 'مكتملة',
        cancelled: 'ملغاة',

        // Common
        error: 'خطأ',
        success: 'تم بنجاح',
        ok: 'حسناً',
        loading: 'جاري التحميل',
        permissionDenied: 'تم رفض الإذن',
        locationPermissionRequired: 'مطلوب إذن الوصول للموقع.',
        updateFailed: 'فشل تحديث الإعدادات',
        confirmLogout: 'هل أنت متأكد من تسجيل الخروج؟',
        account: 'الحساب',
        preferences: 'التفضيلات',
        genericError: 'حدث خطأ ما. حاول مرة أخرى.',
        connectionError: 'فشل الاتصال. تأكد من الإنترنت.',

        // Delete Account
        deleteAccount: 'حذف الحساب',
        deleteAccountConfirm: 'سيؤدي هذا إلى حذف حسابك نهائيًا. ستتم إزالة جميع بياناتك. هل أنت متأكد؟',
        delete: 'حذف',
        accountDeleted: 'تم حذف حسابك بنجاح.',
        deleteAccountFailed: 'فشل حذف الحساب. يرجى المحاولة مرة أخرى.',

        newRequest: 'طلب رحلة جديد',
        accept: 'قبول',
        decline: 'رفض',
        bid: 'عرض سعر',
        pickup: 'الاصطحاب',
        dropoff: 'الوجهة',
        distance: 'المسافة',
        estEarnings: 'الأرباح المتوقعة',

        // Earnings Screen
        totalBalance: 'الرصيد الكلي',
        availableWithdrawal: 'متاح للسحب',
        today: 'اليوم',
        trips: 'رحلات',
        hours: 'ساعات',
        // 'earnings' duplicate fixed

        // My Vehicle Screen
        // 'myVehicle' duplicate fixed
        documentsStatus: 'حالة المستندات',
        driverLicense: 'رخصة القيادة',
        vehicleLicense: 'رخصة السيارة',
        nationalID: 'الرقم القومي',
        uploaded: 'تم الرفع',
        missing: 'مفقود',
        expires: 'ينتهي في',
        uploadRequired: 'مطلوب الرفع',
        viewDocument: 'عرض المستند',
        requestVehicleChange: 'طلب تغيير السيارة',
        vehicleChangePending: 'طلب تغيير السيارة قيد المراجعة',
        vehicleChangeRejected: 'تم رفض طلب تغيير السيارة',
        loadingVehicleInfo: 'جاري تحميل بيانات السيارة...',

        // Support Screen
        contactUs: 'تواصل معنا',
        callUs: 'اتصل بنا',
        whatsapp: 'واتساب',
        myRequests: 'طلباتي',
        newSupportRequest: 'طلب جديد',
        startChat: 'بدء المحادثة',
        whatIsYourIssue: 'ما هي مشكلتك؟',
        enterSubject: 'مثال: مشكلة في الدفع، خطأ في التطبيق...',
        noTickets: 'لا يوجد طلبات مساعدة حتى الآن.',
        enterSubjectError: 'يرجى إدخال الموضوع',

        // Search Screen
        enterPickupLocation: 'أدخل نقطة الالتقاء',
        searchingInEgypt: 'جاري البحث في مصر...',
        chooseOnMap: 'اختر على الخريطة',
        home: 'المنزل',
        work: 'العمل',
        favorites: 'المفضلة',

        // Change Vehicle
        changeVehicle: 'تغيير السيارة',
        vehicleType: 'نوع السيارة',
        vehicleModel: 'موديل السيارة',
        vehiclePlate: 'رقم اللوحة',
        vehicle: 'السيارة',
        licensePhotos: 'صور الرخصة',
        vehiclePhotos: 'صور السيارة',
        licenseFront: 'الرخصة (أمام)',
        licenseBack: 'الرخصة (خلف)',
        front: 'أمام',
        back: 'خلف',
        rightSide: 'يمين',
        leftSide: 'يسار',
        submitRequest: 'إرسال الطلب',
        fillVehicleInfo: 'يرجى إدخال موديل السيارة ورقم اللوحة',
        uploadPending: 'جاري الرفع...',
        car: 'سيارة',
        motorcycle: 'دراجة نارية',
        taxi: 'تاكسي',

        // Customer Home
        whereTo: 'إلى أين؟',
        currentLocation: 'الموقع الحالي',
        searchDestination: 'ابحث عن وجهة',
        recentLocations: 'المواقع الأخيرة',
        clearAll: 'مسح الكل',
        noRecentLocations: 'لا توجد مواقع أخيرة',
        safetyCenter: 'مركز الأمان',
        fetchingLocation: 'جاري تحديد الموقع...',
        exclusiveDiscounts: 'خصومات حصرية لك!',
        dailyDiscounts: 'لا تفوت خصوماتك اليومية',
        clickHere: 'اضغط هنا',
        safestTrips: 'أ safest trips with SmartLine',
        enjoy: 'استمتع',
        affordable: 'برحلات',
        tripsWithUs: 'بأسعار معقولة معنا',

        // Trip Options
        chooseRide: 'اختر رحلة',
        from: 'من',
        to: 'إلى',
        km: 'كم',
        min: 'دقيقة',
        bestValue: 'أفضل قيمة',
        recommended: 'موصى به',
        premiumService: 'خدمة مميزة',
        fastest: 'الأسرع',
        select: 'اختر',
        paymentMethod: 'طريقة الدفع',
        cash: 'كاش',
        promoCode: 'كود الخصم',
        apply: 'تطبيق',
        requestFailed: 'فشل الطلب',
        routeNotCalculated: 'لم يتم حساب المسار بعد',
        authError: 'خطأ في المصادقة',
        pleaseLogin: 'يرجى تسجيل الدخول مرة أخرى',

        // Searching Driver
        findingYourDriver: 'جاري البحث عن سائق...',
        searchingNearby: 'جاري البحث في المنطقة',
        driverOffers: 'عروض السائقين',
        acceptRide: 'قبول الرحلة',
        reject: 'رفض',
        offer: 'عرض',
        plate: 'لوحة',
        rating: 'تقييم',
        driverAlreadySelected: 'تم اختيار سائق',
        tripAlreadyAccepted: 'تم قبول هذه الرحلة من سائق آخر',
        viewDriver: 'عرض السائق',
        cancelTrip: 'إلغاء الرحلة',
        cancelConfirm: 'هل أنت متأكد من إلغاء طلب الرحلة؟',
        yesCancel: 'نعم، إلغاء',
        noKeep: 'لا، استمرار',

        // Driver Found
        driverArriving: 'السائق في الطريق',
        arrivingIn: 'الوصول خلال',
        minutes: 'دقيقة',
        call: 'اتصال',
        chat: 'محادثة',
        share: 'مشاركة',
        cancelSearch: 'إلغاء البحث',

        // On Trip
        tripInProgress: 'الرحلة قيد التنفيذ',
        takingYouToDest: 'السائق يقلك إلى وجهتك',
        pickupLocation: 'نقطة الالتقاط',
        destination: 'الوجهة',
        safety: 'الأمان',
        cancelFeeWarning: 'قد يتم تطبيق رسوم الإلغاء',
        tripCancelledMsg: 'تم إلغاء الرحلة',

        // Trip Complete
        tripCompleted: 'اكتملت الرحلة',
        thankYou: 'شكراً لركوبك معنا',
        totalFare: 'الأجرة الكلية',
        payCash: 'يرجى الدفع نقداً للسائق',
        rateDriver: 'قيّم سائقك',
        addTip: 'إضافة بقشيش (اختياري)',
        done: 'تم',

        // Active Trip
        drivingToPickup: 'في الطريق للراكب',
        atPickup: 'في نقطة الالتقاء',
        onTrip: 'في الرحلة',
        tripFinished: 'انتهت الرحلة',
        tripCancelled: 'تم إلغاء الرحلة',
        passengerCancelled: 'قام الراكب بإلغاء الرحلة.',
        arrivedAtPickup: 'وصلت لنقطة الالتقاء',
        startTrip: 'بدء الرحلة',
        completeTrip: 'إنهاء الرحلة',
        refreshStatus: 'تحديث الحالة',
        payment: 'الدفع',
        // Role Selection
        welcomeTitle: 'أهلاً بيك في سمارت لاين',
        welcomeSubtitle: 'تحب تستخدم التطبيق إزاي؟',
        iNeedRide: 'عايز عربية توصلني',
        bookRides: 'اطلب رحلة ووصل بالسلامة',
        iWantToDrive: 'معايا عربية وعايز اشتغل',
        earnMoney: 'زود دخلك واشتغل في الوقت اللي يناسبك',
        changeRoleLater: 'متقلقش، ممكن تغير اختيارك ده بعدين',

        // Auth Flow
        enterPhoneNumber: 'دخل رقم موبايلك',
        weWillSendCode: 'هبعتلك كود تأكيد في رسالة',
        continue: 'كمل',
        verifyNumber: 'تأكيد الرقم',
        enterCodeSentTo: 'دخل الكود اللي وصلك على',
        resendCode: 'إعادة إرسال الكود',
        availableIn: 'متاح خلال',
        verify: 'تأكيد',
        createAccount: 'إنشاء حساب جديد',
        signUpAs: 'تسجيل كـ',
        fullName: 'الاسم بالكامل',
        email: 'البريد الإلكتروني',
        password: 'كلمة السر',
        confirmPassword: 'تأكيد كلمة السر',
        createAccountBtn: 'إنشاء الحساب',
        enterPassword: 'دخل كلمة السر',
        welcomeBack: 'أهلاً بيك تاني',
        login: 'تسجيل الدخول',
        pleaseFillAllFields: 'من فضلك املأ كل البيانات',
        passwordsDoNotMatch: 'كلمة السر مش زي بعض',
        signupFailed: 'فشل إنشاء الحساب، حاول تاني',
        passenger: 'راكب',
        enterPasswordFor: 'دخل كلمة السر لرقم',
        forgotPassword: 'نسيت كلمة السر؟',
        pleaseEnterPassword: 'من فضلك دخل كلمة السر',
        loginError: 'خطأ في التسجيل',
        loginFailed: 'فشل تسجيل الدخول',
        accountNotDriver: 'الحساب ده مش متسجل كسائق. من فضلك سجل حساب جديد أو ادخل كعميل.',
        incorrectNumber: 'رقم الموبايل غلط أو مش متسجل',
        incorrectPassword: 'كلمة السر غلط',
        personalInfo: 'بيانات شخصية',
        step: 'خطوة',
        of: 'من',
        nationalIdNumber: 'رقم البطاقة (14 رقم)',
        city: 'المدينة',
        nextVehicleInfo: 'التالي: بيانات العربية',
        nextProfilePhoto: 'التالي: الصورة الشخصية',
        nextDocuments: 'التالي: المستندات',
        profilePhoto: 'الصورة الشخصية',
        uploadProfilePhoto: 'رفع الصورة الشخصية',
        profilePhotoDescription: 'من فضلك ارفع صورة واضحة ليك. الصورة دي هتظهر للعملاء.',
        removePhoto: 'حذف الصورة',
        resetPassword: 'إعادة تعيين كلمة المرور',
        newPassword: 'كلمة المرور الجديدة',
        passwordResetSuccess: 'تم تغيير كلمة المرور بنجاح.',
        securityLogin: 'الأمان وتسجيل الدخول',
        notifications: 'الإشعارات',
        version: 'الإصدار',
        // SideMenu
        editPersonalInfo: 'تعديل البيانات',
        messages: 'الرسائل',
        inviteFriends: 'دعوة أصدقاء',
        locationPreferences: 'تفضيلات المواقع',
        manageSavedLocations: 'إدارة المنزل والعمل والمفضلة',
        setLocation: 'تحديد الموقع',
        updateLocation: 'تحديث',
        addFavorite: 'إضافة مفضلة',
        noFavoritesSaved: 'لا توجد مفضلات بعد.',
        homeLocationNotSet: 'لم يتم تحديد موقع المنزل.',
        workLocationNotSet: 'لم يتم تحديد موقع العمل.',
        favoritesLimitReached: 'وصلت للحد الأقصى للمفضلة.',
        deleteLocationConfirm: 'هل تريد حذف هذا الموقع المحفوظ؟',
        saveFailed: 'فشل حفظ الموقع.',
        driveWithUs: 'انضم كسائق',
        discounts: 'الخصومات',
        scan: 'مسح الكود',

        // Promos & Discounts
        checking: 'جاري التحقق...',
        promoApplied: 'تم تطبيق الخصم!',
        youWillGet: 'ستحصل على',
        offNextRide: 'خصم على رحلتك القادمة.',
        bookNow: 'احجز الآن',
        invalidCode: 'كود غير صحيح',
        promoInvalid: 'كود الخصم هذا غير صالح.',
        enterPromoCode: 'أدخل كود الخصم',
        promoSubtitle: 'لديك كود خصم؟ أدخله بالأسفل.',
        promoPlaceholder: 'مثال: SMART50',
        activePromotions: 'العروض المتاحة',
        availablePromotions: 'العروض المتاحة',
        noActivePromos: 'لا توجد عروض متاحة حالياً.',
        validUntil: 'صالح حتى',
        noExpiry: 'لا تنتهي صلاحيته',
        use: 'استخدم',
        max: 'حد أقصى',
        off: 'خصم',
        applyCode: 'تطبيق الكود',
        close: 'إغلاق',
        selectPaymentMethod: 'اختر طريقة الدفع',
        rideSaver: 'توفير',
        rideComfort: 'راحة',
        rideVIP: 'VIP',
        rideScooter: 'سكوتر',
        rideTaxi: 'تاكسي',
        currency: 'جنيه',

        // Safety Screen Extra
        sendSosAlert: 'إرسال نداء استغاثة SOS',
        sosAlertDescription: 'سيؤدي هذا إلى إبلاغ فريق الأمان ومشاركة موقعك المباشر وتفاصيل الرحلة فوراً.',
        sendAlert: 'إرسال التنبيه',
        detectingLocation: 'لا يمكننا تحديد موقعك بعد. يرجى الانتظار قليلاً.',
        noActiveTrip: 'لا توجد رحلة نشطة',
        noActiveTripDesc: 'لم نتمكن من العثور على رحلة نشطة لربط هذا التنبيه بها.',
        sosSentDesc: 'تم إبلاغ فريقنا وجاري تتبع موقعك. ابق هادئاً.',
        failed: 'فشل',
        sosFailed: 'تعذر إرسال التنبيه. يرجى الاتصال بالشرطة مباشرة.',
        safetyToolkit: 'أدوات الأمان',
        safetyToolkitDesc: 'سلامتك هي أولويتنا القصوى. يمكنك الوصول إلى هذه الأدوات في أي وقت أثناء رحلتك.',
        emergencyAssistance: 'المساعدة الطارئة',
        sosEmergency: 'تنبيه طوارئ SOS',
        sosEmergencySub: 'إشعار فريق الدعم فوراً',
        callPolice: 'اتصل بالشرطة',
        callPoliceSub: 'خط مباشر 122',
        promoCodes: 'كود الخصم',

        // Referral System
        haveReferralCode: 'عندك كود دعوة؟',
        referralCodePlaceholder: 'مثال: ABC1234',
        referralCodeHint: 'ادخل كود صاحبك عشان تاخدوا مكافآت',
        referAndEarn: 'ادعو واكسب',
        referralTitle: 'خصم ٥٠٪ ليك وليه',
        referralDescription: 'ادعي أصحابك يستخدموا سمارت لاين. لما يعملوا أول رحلة، هتاخدوا الاتنين خصم ٥٠٪!',
        yourReferralCode: 'كود الدعوة بتاعك',
        copy: 'نسخ',
        copied: 'تم النسخ!',
        shareCode: 'شارك الكود',
        referralCodeCopied: 'تم نسخ كود الدعوة!',
        referrals: 'دعوات',
        totalEarnedRef: 'أرباح',
    }
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [language, setLanguageState] = useState<Language>('ar');

    useEffect(() => {
        loadLanguage();
    }, []);

    const loadLanguage = async () => {
        try {
            const storedLang = await AsyncStorage.getItem('appLanguage');
            if (storedLang === 'ar' || storedLang === 'en') {
                setLanguageState(storedLang);
            }
        } catch (e) {
            console.error("Failed to load language", e);
        }
    };

    const setLanguage = async (lang: Language) => {
        try {
            await AsyncStorage.setItem('appLanguage', lang);
            setLanguageState(lang);

            // Handle RTL - for Arabic, enable RTL; for English, disable RTL
            const shouldBeRTL = lang === 'ar';
            if (I18nManager.isRTL !== shouldBeRTL) {
                I18nManager.allowRTL(shouldBeRTL);
                I18nManager.forceRTL(shouldBeRTL);
            }
        } catch (e) {
            console.error("Failed to save language", e);
        }
    };

    const t = (key: string) => {
        const keys = key.split('.');
        let value: any = translations[language];
        for (const k of keys) {
            if (value && value[k]) {
                value = value[k];
            } else {
                return key; // Fallback to key if not found
            }
        }
        return value as string;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, isRTL: language === 'ar', t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => useContext(LanguageContext);
