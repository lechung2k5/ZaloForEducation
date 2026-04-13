import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SplashScreenProps {
  isVisible: boolean;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ isVisible }) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          id="splash-screen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ 
            opacity: 0,
            scale: 1.05,
            filter: 'blur(10px)',
            transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
          }}
          className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center overflow-hidden"
        >
          {/* Logo Content Container */}
          <div className="flex flex-col items-center justify-center">
            {/* Logo Box with Bounce Animation */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ 
                scale: [0.9, 1.05, 1],
                opacity: 1
              }}
              transition={{ 
                duration: 0.8,
                times: [0, 0.6, 1],
                ease: "easeOut"
              }}
              className="relative"
            >
              {/* Breathing Loop Animation Layer */}
              <motion.div
                animate={{ scale: [1, 1.02, 1] }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="w-24 h-24 bg-[#eef4ff] rounded-[2rem] flex items-center justify-center shadow-2xl shadow-[#00418f]/10 border border-[#00418f]/5"
              >
                <img 
                  src="/logo_blue.png" 
                  alt="Zalo Education Logo" 
                  className="w-full h-full object-cover"
                />
              </motion.div>
            </motion.div>

            {/* Brand Text */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="flex flex-col items-center mt-8 text-center"
            >
              <h1 className="text-4xl font-heading font-black tracking-tighter text-[#00418f] mb-3">
                Zalo Education
              </h1>
              
              {/* Subtitle with slide-up */}
              <motion.p
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1.0, duration: 0.6 }}
                className="text-xs uppercase tracking-[0.4em] text-[#6F6F6F] font-body font-bold"
              >
                Khai phóng tiềm năng tri thức
              </motion.p>
            </motion.div>
          </div>

          {/* Minimalist Loading Indicator */}
          <motion.div 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 120, opacity: 1 }}
            transition={{ delay: 1.4, duration: 1 }}
            className="absolute bottom-16 h-[1.5px] bg-[#00418f]/10 rounded-full overflow-hidden"
          >
            <motion.div 
              animate={{ x: [-120, 120] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className="w-20 h-full bg-[#00418f]/40"
            />
          </motion.div>

          {/* Decorative Elements */}
          <div className="absolute top-[-10%] right-[-10%] w-[40%] aspect-square bg-[#00418f]/[0.02] rounded-full blur-[100px]" />
          <div className="absolute bottom-[-5%] left-[-5%] w-[30%] aspect-square bg-[#00418f]/[0.01] rounded-full blur-[80px]" />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;
