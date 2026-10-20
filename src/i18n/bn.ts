import type { Messages } from './en';

/** বাংলা. Same keys as en.ts (the type enforces it). */
export const bn: Messages = {
  common: {
    appName: 'ক্রীড়াঘর',
    signIn: 'সাইন ইন',
    signOut: 'সাইন আউট',
    loading: 'লোড হচ্ছে',
    retry: 'আবার চেষ্টা করুন',
    offline: 'ক্রীড়াঘরে পৌঁছানো যাচ্ছে না। ইন্টারনেট সংযোগ দেখুন।',
    somethingWrong: 'কিছু একটা ভুল হয়েছে। আবার চেষ্টা করুন।',
    comingSoon: 'পরের আপডেটে আসছে।',
  },
  tabs: {
    home: 'হোম',
    events: 'ইভেন্ট',
    matches: 'ম্যাচ',
    ranks: 'র‍্যাংক',
    account: 'অ্যাকাউন্ট',
  },
  home: {
    heroTitle: 'PUBG Mobile আর Free Fire খেলুন।',
    heroPrize: 'জিতুন আসল পুরস্কার।',
    heroSub: 'ইভেন্ট, ভেন্যু আর খেলার সরঞ্জাম, এক অ্যাকাউন্টে।',
    myAccount: 'আমার অ্যাকাউন্ট',
  },
  events: {
    title: 'ইভেন্ট',
    empty: 'এখন কোনো ইভেন্ট খোলা নেই। নতুন ইভেন্ট আগে এখানেই আসবে।',
  },
  matches: {
    title: 'আমার ম্যাচ',
    signedOut: 'আপনার ম্যাচ দেখতে, চেক-ইন করতে আর রুম আইডি পেতে সাইন ইন করুন।',
  },
  ranks: {
    title: 'র‍্যাংক',
    empty: 'প্রথম ইভেন্ট শেষ হলে লিডারবোর্ড দেখা যাবে।',
  },
  signIn: {
    title: 'ক্রীড়াঘরে সাইন ইন করুন',
    sub: 'অ্যাপ, kriraghor.com আর ইস্পোর্টসের জন্য একটাই অ্যাকাউন্ট।',
    phone: 'মোবাইল নম্বর',
    sendCode: 'কোড পাঠান',
    codeSent: 'আমরা একটি কোড পাঠিয়েছি। ৫ মিনিটে মেয়াদ শেষ হবে।',
    code: '৬ সংখ্যার কোড',
    verify: 'যাচাই করে এগিয়ে যান',
    name: 'আপনার নাম',
    createAccount: 'অ্যাকাউন্ট খুলুন',
  },
  account: {
    title: 'অ্যাকাউন্ট',
    signedOut: 'আপনি সাইন ইন করেননি।',
    sameSession: 'এই সাইন ইন kriraghor.com আর ইস্পোর্টসেও কাজ করে।',
    phone: 'ফোন',
    email: 'ইমেইল',
    roles: 'ভূমিকা',
    language: 'ভাষা',
    notifications: 'নোটিফিকেশন',
    notificationsHelp: 'নোটিফিকেশন চালু থাকলে রুম আইডি, চেক-ইন আর ফলাফল এই ফোনে আসবে।',
    enableNotifications: 'নোটিফিকেশন চালু করুন',
    pushRegistered: 'এই ফোনে নোটিফিকেশন আসবে।',
    pushDenied: 'ফোনের সেটিংসে নোটিফিকেশন বন্ধ আছে।',
    pushUnavailable: 'নোটিফিকেশনের জন্য আসল ফোন আর স্টোর বা ডেভেলপমেন্ট বিল্ড লাগবে।',
  },
};
