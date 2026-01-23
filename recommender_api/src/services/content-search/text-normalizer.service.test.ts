import { describe, it, expect } from 'vitest';
import { tokenize } from './text-normalizer.service.js';

describe('text-normalizer.service', () => {
  describe('tokenize', () => {
    describe('stopword removal', () => {
      it('removes English stopwords ("the", "and", "is", etc.)', () => {
        const text = 'the quick brown fox is and was';
        const tokens = tokenize(text, 'none');

        expect(tokens).not.toContain('the');
        expect(tokens).not.toContain('and');
        expect(tokens).not.toContain('is');
        expect(tokens).not.toContain('was');
        expect(tokens).toContain('quick');
        expect(tokens).toContain('brown');
        expect(tokens).toContain('fox');
      });

      it('removes resume filler words ("experience", "team", "role")', () => {
        const text = 'worked with team on experience in role';
        const tokens = tokenize(text, 'none');

        expect(tokens).not.toContain('worked');
        expect(tokens).not.toContain('team');
        expect(tokens).not.toContain('experience');
        expect(tokens).not.toContain('role');
      });

      it('removes single-character tokens', () => {
        const text = 'a b c test x y z example';
        const tokens = tokenize(text, 'none');

        expect(tokens).not.toContain('a');
        expect(tokens).not.toContain('b');
        expect(tokens).not.toContain('c');
        expect(tokens).not.toContain('x');
        expect(tokens).not.toContain('y');
        expect(tokens).not.toContain('z');
        expect(tokens).toContain('test');
        expect(tokens).toContain('example');
      });
    });

    describe('tokenization', () => {
      it('tokenizes text correctly (handles punctuation, whitespace)', () => {
        const text = 'Hello, world! This is a test.';
        const tokens = tokenize(text, 'none');

        expect(tokens).toContain('hello');
        expect(tokens).toContain('world');
        expect(tokens).toContain('test');
        expect(tokens).not.toContain(',');
        expect(tokens).not.toContain('!');
        expect(tokens).not.toContain('.');
      });

      it('converts all tokens to lowercase', () => {
        const text = 'React TypeScript JavaScript';
        const tokens = tokenize(text, 'none');

        // Note: "React" without .js suffix stays as "react", not "reactjs"
        expect(tokens).toEqual(expect.arrayContaining(['react', 'typescript', 'javascript']));
        expect(tokens).not.toContain('React');
        expect(tokens).not.toContain('TypeScript');
      });

      it('handles multiple spaces and newlines', () => {
        const text = 'React    TypeScript\n\nJavaScript';
        const tokens = tokenize(text, 'none');

        // Note: "React" without .js suffix stays as "react", not "reactjs"
        expect(tokens).toContain('react');
        expect(tokens).toContain('typescript');
        expect(tokens).toContain('javascript');
      });
    });

    describe('empty/null input handling', () => {
      it('handles empty string gracefully', () => {
        const tokens = tokenize('', 'none');
        expect(tokens).toEqual([]);
      });

      it('handles whitespace-only string', () => {
        const tokens = tokenize('   \n\t   ', 'none');
        expect(tokens).toEqual([]);
      });

      it('handles string with only stopwords', () => {
        const tokens = tokenize('the a an is was are were', 'none');
        expect(tokens).toEqual([]);
      });
    });

    describe('tech compound normalization', () => {
      it('normalizes Node.js variations to "nodejs"', () => {
        expect(tokenize('Node.js', 'none')).toContain('nodejs');
        expect(tokenize('NodeJS', 'none')).toContain('nodejs');
        expect(tokenize('Nodejs', 'none')).toContain('nodejs');
      });

      it('normalizes React.js to "reactjs"', () => {
        expect(tokenize('React.js', 'none')).toContain('reactjs');
        expect(tokenize('ReactJS', 'none')).toContain('reactjs');
      });

      it('normalizes Vue.js to "vuejs"', () => {
        expect(tokenize('Vue.js', 'none')).toContain('vuejs');
        expect(tokenize('VueJS', 'none')).toContain('vuejs');
      });

      it('normalizes Next.js to "nextjs"', () => {
        expect(tokenize('Next.js', 'none')).toContain('nextjs');
      });

      it('normalizes C++ to "cpp"', () => {
        expect(tokenize('C++', 'none')).toContain('cpp');
      });

      it('normalizes C# to "csharp"', () => {
        expect(tokenize('C#', 'none')).toContain('csharp');
      });

      it('normalizes .NET to "dotnet"', () => {
        expect(tokenize('.NET', 'none')).toContain('dotnet');
        // ASP.NET becomes "aspdotnet" because asp.net pattern takes precedence, then .net pattern runs
        expect(tokenize('ASP.NET', 'none')).toContain('aspdotnet');
      });

      it('normalizes k8s to "kubernetes"', () => {
        expect(tokenize('k8s', 'none')).toContain('kubernetes');
      });

      it('strips version numbers from languages', () => {
        expect(tokenize('Python 3.9', 'none')).toContain('python');
        expect(tokenize('Python3.9', 'none')).not.toContain('3');
        expect(tokenize('Java 17', 'none')).toContain('java');
        // "Node 18" becomes "node" (not nodejs) - the nodejs pattern requires .js suffix
        expect(tokenize('Node 18', 'none')).toContain('node');
      });
    });

    describe('phrase replacement', () => {
      it('replaces "machine learning" with single token', () => {
        const tokens = tokenize('experience in machine learning', 'none');
        expect(tokens).toContain('machinelearning');
        expect(tokens).not.toContain('machine');
        expect(tokens).not.toContain('learning');
      });

      it('replaces "deep learning" with single token', () => {
        const tokens = tokenize('deep learning models', 'none');
        expect(tokens).toContain('deeplearning');
      });

      it('replaces "ci/cd" variations with "cicd"', () => {
        expect(tokenize('CI/CD pipelines', 'none')).toContain('cicd');
        expect(tokenize('ci cd', 'none')).toContain('cicd');
      });

      it('replaces "front end" and "back end" with single tokens', () => {
        expect(tokenize('front end development', 'none')).toContain('frontend');
        expect(tokenize('back end services', 'none')).toContain('backend');
      });

      it('replaces "full stack" with "fullstack"', () => {
        expect(tokenize('full stack developer', 'none')).toContain('fullstack');
      });

      it('replaces "micro services" with "microservices"', () => {
        expect(tokenize('micro services architecture', 'none')).toContain('microservices');
      });

      it('replaces "rest api" and "restful api" with "restapi"', () => {
        expect(tokenize('REST API', 'none')).toContain('restapi');
        expect(tokenize('RESTful API', 'none')).toContain('restapi');
      });
    });

    describe('normalization strategies', () => {
      describe('stemming strategy', () => {
        it('stems words using Porter Stemmer', () => {
          const tokens = tokenize('running applications developer', 'stemming');
          // Porter Stemmer outputs: "run" for "running", "applic" for "applications", "develop" for "developer"
          expect(tokens).toContain('run');
          expect(tokens).toContain('applic');
          expect(tokens).toContain('develop');
        });
      });

      describe('lemma strategy', () => {
        it('lemmatizes words when lemmatizer supports them', () => {
          const tokens = tokenize('applications running', 'lemma');
          // The lemmatizer package behavior - check that it runs without error
          // The exact output depends on the lemmatizer's dictionary
          expect(tokens.length).toBeGreaterThan(0);
          // Should convert "running" to "run"
          expect(tokens).toContain('run');
        });
      });

      describe('none strategy', () => {
        it('keeps words unchanged', () => {
          const tokens = tokenize('applications running developer', 'none');
          expect(tokens).toContain('applications');
          expect(tokens).toContain('running');
          expect(tokens).toContain('developer');
        });
      });
    });

    describe('real-world resume text', () => {
      it('processes realistic resume text correctly', () => {
        const resumeText = `
          Senior Software Engineer with 8 years of experience in React.js and Node.js.
          Built microservices using Kubernetes (k8s) and deployed to AWS.
          Expert in machine learning and deep learning frameworks.
        `;

        const tokens = tokenize(resumeText, 'none');

        // Should contain normalized tech terms
        expect(tokens).toContain('senior');
        expect(tokens).toContain('software');
        expect(tokens).toContain('engineer');
        expect(tokens).toContain('reactjs');
        expect(tokens).toContain('nodejs');
        expect(tokens).toContain('microservices');
        expect(tokens).toContain('kubernetes');
        expect(tokens).toContain('aws');
        expect(tokens).toContain('machinelearning');
        expect(tokens).toContain('deeplearning');
        expect(tokens).toContain('frameworks');

        // Should not contain stopwords
        expect(tokens).not.toContain('with');
        expect(tokens).not.toContain('years');
        expect(tokens).not.toContain('of');
        expect(tokens).not.toContain('and');
        expect(tokens).not.toContain('to');
      });
    });
  });
});
