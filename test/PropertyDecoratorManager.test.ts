/**
 * PropertyDecoratorManager comprehensive test suite
 * Focused on improving code coverage for property.ts
 */

import { PropertyDecoratorManager, PropertyWrapperFunction } from '../src/index';
import { PropertyDecoratorMetadata } from '../src/manager/property';
import { DecoratorMetadata } from '../src/manager/type';

describe('PropertyDecoratorManager - Coverage Enhancement', () => {
  let manager: PropertyDecoratorManager;

  beforeEach(() => {
    manager = PropertyDecoratorManager.getInstance();
    manager.clearCache();
  });

  afterEach(() => {
    manager.clearCache();
  });

  describe('Error Handling', () => {
    test('should handle wrapper function throwing errors', () => {
      const errorWrapper: PropertyWrapperFunction = () => {
        throw new Error('Wrapper function error');
      };

      manager.registerWrapper('error', errorWrapper);

      class TestClass {
        public prop: string = 'test';
      }

      const metadata: DecoratorMetadata = {
        type: 'error',
        config: { defaultValue: 'default' },
        applied: false,
        priority: 1
      };

      // The wrapper function error should be propagated to caller
      expect(() => {
        manager.registerDecorator(
          TestClass.prototype,
          'prop',
          metadata
        );
      }).toThrow('Wrapper function error');
    });

    test('should handle null/undefined target gracefully', () => {
      expect(manager.isDecorated(null, 'prop')).toBe(false);
      expect(manager.isDecorated(undefined, 'prop')).toBe(false);
      expect(manager.getDecoratorMetadata(null, 'prop')).toBeNull();
      expect(manager.getDecoratorMetadata(undefined, 'prop')).toBeNull();
      expect(manager.getPropertyWrapper(null, 'prop')).toBeNull();
      expect(manager.getPropertyWrapper(undefined, 'prop')).toBeNull();
    });

    test('should handle non-object target gracefully', () => {
      expect(manager.isDecorated('string', 'prop')).toBe(false);
      expect(manager.isDecorated(123, 'prop')).toBe(false);
      expect(manager.getDecoratorMetadata('string', 'prop')).toBeNull();
      expect(manager.getPropertyWrapper('string', 'prop')).toBeNull();
    });
  });

  describe('Boundary Conditions', () => {
    test('should handle PropertyDecoratorMetadata without wrapperTypes', () => {
      class TestClass {
        public prop: string = 'test';
      }

      const metadata: PropertyDecoratorMetadata = {
        config: { defaultValue: 'default' },
        priority: 1
        // No wrapperTypes
      };

      const descriptor = manager.registerDecorator(
        TestClass.prototype,
        'prop',
        metadata
      );

      expect(descriptor).toBeDefined();
    });

    test('should handle duplicate decorator registration', () => {
      const wrapper: PropertyWrapperFunction = (desc) => desc || {
        value: undefined,
        writable: true,
        enumerable: true,
        configurable: true
      };

      manager.registerWrapper('duplicate', wrapper);

      class TestClass {
        public prop: string = 'test';
      }

      const metadata: DecoratorMetadata = {
        type: 'duplicate',
        config: {},
        applied: false,
        priority: 1
      };

      // First registration
      const firstDescriptor = manager.registerDecorator(
        TestClass.prototype,
        'prop',
        metadata
      );

      // Second registration (should skip and return existing/fallback)
      const secondDescriptor = manager.registerDecorator(
        TestClass.prototype,
        'prop',
        metadata
      );

      expect(firstDescriptor).toBeDefined();
      expect(secondDescriptor).toBeDefined();
    });

    test('should handle metadata without config', () => {
      const wrapper: PropertyWrapperFunction = (desc, config) => {
        return {
          get: () => config?.defaultValue || 'no-config',
          set: () => {},
          enumerable: true,
          configurable: true
        };
      };

      manager.registerWrapper('no-config', wrapper);

      class TestClass {
        public prop: string = 'test';
      }

      const metadata: DecoratorMetadata = {
        type: 'no-config',
        config: {}, // Empty config
        applied: false,
        priority: 1
      };

      const descriptor = manager.registerDecorator(
        TestClass.prototype,
        'prop',
        metadata
      );

      expect(descriptor).toBeDefined();
    });

    test('should handle wrapper type not registered', () => {
      class TestClass {
        public prop: string = 'test';
      }

      const metadata: PropertyDecoratorMetadata = {
        wrapperTypes: ['nonexistent-wrapper'],
        config: { defaultValue: 'default' }
      };

      const descriptor = manager.registerDecorator(
        TestClass.prototype,
        'prop',
        metadata
      );

      expect(descriptor).toBeDefined();
    });
  });

  describe('Field Initializer Handling', () => {
    test('should handle property with field initializer and defaultValue conflict', () => {
      const wrapper: PropertyWrapperFunction = (originalDescriptor, config, propertyName) => {
        return {
          get: function() {
            const privateKey = `_${propertyName}`;
            if (!(privateKey in this)) {
              (this as any)[privateKey] = config.defaultValue;
            }
            return (this as any)[privateKey];
          },
          set: function(value: any) {
            (this as any)[`_${propertyName}`] = value;
          },
          enumerable: true,
          configurable: true
        };
      };

      manager.registerWrapper('field-init', wrapper);

      class TestClass {
        public prop: string = 'field-initializer'; // Field initializer
      }

      const metadata: DecoratorMetadata = {
        type: 'field-init',
        config: { defaultValue: 'decorator-default' }, // Different from field initializer
        applied: false,
        priority: 1
      };

      const descriptor = manager.registerDecorator(
        TestClass.prototype,
        'prop',
        metadata
      );

      Object.defineProperty(TestClass.prototype, 'prop', descriptor);

      const instance = new TestClass();
      // Should use field initializer value
      expect(instance.prop).toBe('field-initializer');
    });

    test('should handle property without field initializer using defaultValue', () => {
      const wrapper: PropertyWrapperFunction = (originalDescriptor, config, propertyName) => {
        return {
          get: function() {
            const privateKey = `_${propertyName}`;
            if (!(privateKey in this)) {
              (this as any)[privateKey] = config.defaultValue;
            }
            return (this as any)[privateKey];
          },
          set: function(value: any) {
            (this as any)[`_${propertyName}`] = value;
          },
          enumerable: true,
          configurable: true
        };
      };

      manager.registerWrapper('no-field-init', wrapper);

      class TestClass {
        public prop: string; // No field initializer
      }

      const metadata: DecoratorMetadata = {
        type: 'no-field-init',
        config: { defaultValue: 'decorator-default' },
        applied: false,
        priority: 1
      };

      const descriptor = manager.registerDecorator(
        TestClass.prototype,
        'prop',
        metadata
      );

      Object.defineProperty(TestClass.prototype, 'prop', descriptor);

      const instance = new TestClass();
      // Delete instance property to test prototype getter
      delete (instance as any).prop;
      expect(instance.prop).toBe('decorator-default');
    });

    test('should handle descriptor without getter/setter but with defaultValue', () => {
      class TestClass {
        public prop: string;
      }

      const metadata: PropertyDecoratorMetadata = {
        // No wrapperTypes, should use default descriptor creation
        config: { defaultValue: 'default-value' }
      };

      const descriptor = manager.registerDecorator(
        TestClass.prototype,
        'prop',
        metadata
      );

      Object.defineProperty(TestClass.prototype, 'prop', descriptor);

      const instance = new TestClass();
      delete (instance as any).prop; // Remove instance property
      expect(instance.prop).toBe('default-value');
    });
  });

  describe('Cache and Utility Methods', () => {
    test('should clear cache properly', () => {
      const wrapper: PropertyWrapperFunction = (desc) => desc || {
        value: undefined,
        writable: true,
        enumerable: true,
        configurable: true
      };

      manager.registerWrapper('cache-test', wrapper);

      class TestClass {
        public prop: string = 'test';
      }

      const metadata: DecoratorMetadata = {
        type: 'cache-test',
        config: {},
        applied: false,
        priority: 1
      };

      manager.registerDecorator(TestClass.prototype, 'prop', metadata);

      // Verify something is in cache/registry
      expect(manager.getPropertyWrapper(TestClass.prototype, 'prop')).toBeTruthy();

      manager.clearCache();

      // After clear, should be empty
      expect(manager.getPropertyWrapper(TestClass.prototype, 'prop')).toBeNull();
    });

    test('should provide cache statistics', () => {
      const stats = manager.getCacheStats();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('keys');
      expect(Array.isArray(stats.keys)).toBe(true);
    });

    test('should unregister wrapper correctly', () => {
      const wrapper: PropertyWrapperFunction = (desc) => desc || {
        value: undefined,
        writable: true,
        enumerable: true,
        configurable: true
      };

      manager.registerWrapper('to-unregister', wrapper);
      expect(manager.hasWrapper('to-unregister')).toBe(true);

      const unregistered = manager.unregisterWrapper('to-unregister');
      expect(unregistered).toBe(true);
      expect(manager.hasWrapper('to-unregister')).toBe(false);

      // Try to unregister again
      const unregisteredAgain = manager.unregisterWrapper('to-unregister');
      expect(unregisteredAgain).toBe(false);
    });

    test('should list registered wrapper types', () => {
      const wrapper: PropertyWrapperFunction = (desc) => desc || {
        value: undefined,
        writable: true,
        enumerable: true,
        configurable: true
      };

      manager.registerWrapper('type1', wrapper);
      manager.registerWrapper('type2', wrapper);

      const types = manager.getRegisteredTypes();
      expect(types).toContain('type1');
      expect(types).toContain('type2');
    });

    test('should remove property wrapper correctly', () => {
      const wrapper: PropertyWrapperFunction = (desc) => desc || {
        value: undefined,
        writable: true,
        enumerable: true,
        configurable: true
      };

      manager.registerWrapper('removable', wrapper);

      class TestClass {
        public prop: string = 'test';
      }

      const metadata: DecoratorMetadata = {
        type: 'removable',
        config: {},
        applied: false,
        priority: 1
      };

      manager.registerDecorator(TestClass.prototype, 'prop', metadata);
      expect(manager.getPropertyWrapper(TestClass.prototype, 'prop')).toBeTruthy();

      const removed = manager.removePropertyWrapper(TestClass.prototype, 'prop');
      expect(removed).toBe(true);
      expect(manager.getPropertyWrapper(TestClass.prototype, 'prop')).toBeNull();

      // Try to remove again
      const removedAgain = manager.removePropertyWrapper(TestClass.prototype, 'prop');
      expect(removedAgain).toBe(false);
    });
  });

  describe('PropertyDecoratorMetadata Format', () => {
    test('should handle PropertyDecoratorMetadata with multiple wrapperTypes', () => {
      const wrapper1: PropertyWrapperFunction = (desc) => desc || {
        value: 'wrapper1',
        writable: true,
        enumerable: true,
        configurable: true
      };

      const wrapper2: PropertyWrapperFunction = (desc) => desc || {
        value: 'wrapper2',
        writable: true,
        enumerable: true,
        configurable: true
      };

      manager.registerWrapper('wrapper1', wrapper1);
      manager.registerWrapper('wrapper2', wrapper2);

      class TestClass {
        public prop: string = 'test';
      }

      const metadata: PropertyDecoratorMetadata = {
        wrapperTypes: ['wrapper1', 'wrapper2'],
        config: { defaultValue: 'default' },
        priority: 1
      };

      const descriptor = manager.registerDecorator(
        TestClass.prototype,
        'prop',
        metadata
      );

      expect(descriptor).toBeDefined();

      const wrapper = manager.getPropertyWrapper(TestClass.prototype, 'prop');
      expect(wrapper).toBeTruthy();
      expect(wrapper!.decorators.has('wrapper1')).toBe(true);
      expect(wrapper!.decorators.has('wrapper2')).toBe(true);
    });

    test('should handle metadata without config or priority', () => {
      const wrapper: PropertyWrapperFunction = (desc) => desc || {
        value: undefined,
        writable: true,
        enumerable: true,
        configurable: true
      };

      manager.registerWrapper('minimal', wrapper);

      class TestClass {
        public prop: string = 'test';
      }

      const metadata: PropertyDecoratorMetadata = {
        wrapperTypes: ['minimal']
        // No config or priority
      };

      const descriptor = manager.registerDecorator(
        TestClass.prototype,
        'prop',
        metadata
      );

      expect(descriptor).toBeDefined();
    });
  });

  describe('Generate Property Key', () => {
    test('should generate consistent keys for same target and property', () => {
      class TestClass {}

      const wrapper1 = manager.getPropertyWrapper(TestClass.prototype, 'prop1');
      const wrapper2 = manager.getPropertyWrapper(TestClass.prototype, 'prop1');

      // Both should be null (not registered), but the key generation should be consistent
      expect(wrapper1).toBeNull();
      expect(wrapper2).toBeNull();
    });

    test('should handle target without constructor', () => {
      const target = Object.create(null); // No constructor

      expect(manager.isDecorated(target, 'prop')).toBe(false);
      expect(manager.getPropertyWrapper(target, 'prop')).toBeNull();
    });
  });

  describe('Decorated Properties Listing', () => {
    test('should list all decorated properties correctly', () => {
      const wrapper: PropertyWrapperFunction = (desc) => desc || {
        value: undefined,
        writable: true,
        enumerable: true,
        configurable: true
      };

      manager.registerWrapper('list-test', wrapper);

      class TestClass1 {
        public prop1: string = 'test1';
      }

      class TestClass2 {
        public prop2: string = 'test2';
      }

      const metadata: DecoratorMetadata = {
        type: 'list-test',
        config: {},
        applied: false,
        priority: 1
      };

      manager.registerDecorator(TestClass1.prototype, 'prop1', metadata);
      manager.registerDecorator(TestClass2.prototype, 'prop2', metadata);

      const decoratedProps = manager.getDecoratedProperties();
      
      const prop1Entry = decoratedProps.find(p => p.propertyName === 'prop1');
      const prop2Entry = decoratedProps.find(p => p.propertyName === 'prop2');

      expect(prop1Entry).toBeTruthy();
      expect(prop2Entry).toBeTruthy();
      expect(prop1Entry!.decorators).toContain('list-test');
      expect(prop2Entry!.decorators).toContain('list-test');
      expect(prop1Entry!.isWrapped).toBe(true);
      expect(prop2Entry!.isWrapped).toBe(true);
    });
  });
}); 