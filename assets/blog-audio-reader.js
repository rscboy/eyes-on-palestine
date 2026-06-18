(function () {
  "use strict";

  var synthesis = window.speechSynthesis;
  var activeReader = null;

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function splitLongText(text, maxLength) {
    var sentences = normalizeText(text).match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
    var chunks = [];
    var current = "";

    sentences.forEach(function (sentence) {
      var next = normalizeText(current + " " + sentence);
      if (next.length <= maxLength) {
        current = next;
        return;
      }
      if (current) chunks.push(current);
      current = normalizeText(sentence);
      while (current.length > maxLength) {
        var cut = current.lastIndexOf(" ", maxLength);
        if (cut < maxLength * 0.5) cut = maxLength;
        chunks.push(current.slice(0, cut).trim());
        current = current.slice(cut).trim();
      }
    });

    if (current) chunks.push(current);
    return chunks;
  }

  function extractArticleChunks(content) {
    if (!content) return [];
    var blocks = Array.from(content.querySelectorAll("h2, h3, p, blockquote, li"))
      .filter(function (element) {
        return !element.closest("[data-audio-reader-exclude], nav, footer, form, aside");
      })
      .map(function (element) {
        return normalizeText(element.innerText || element.textContent);
      })
      .filter(Boolean);

    if (!blocks.length) blocks = [normalizeText(content.innerText || content.textContent)].filter(Boolean);
    return blocks.reduce(function (all, block) {
      return all.concat(splitLongText(block, 900));
    }, []);
  }

  function BlogAudioReader(options) {
    this.root = options.root;
    this.content = options.content;
    this.language = options.language || "en-US";
    this.rate = options.rate || 0.95;
    this.chunks = [];
    this.index = 0;
    this.state = "idle";
    this.utterance = null;
    this.supported = Boolean(synthesis && window.SpeechSynthesisUtterance);
    this.handlePageExit = this.stop.bind(this);
    this.render();
    this.bind();
  }

  BlogAudioReader.prototype.render = function () {
    if (!this.supported) {
      this.root.innerHTML =
        '<p class="blog-audio-reader-fallback" role="status">Audio reading is not supported in this browser.</p>';
      return;
    }

    this.root.innerHTML =
      '<div class="blog-audio-reader" data-reader-state="idle">' +
        '<button type="button" class="blog-audio-reader-main" data-audio-action="toggle" aria-label="Listen to this piece">' +
          '<span class="blog-audio-reader-icon" aria-hidden="true">' +
            '<svg viewBox="0 0 24 24"><path d="M8 9H4v6h4l5 4V5L8 9Z"></path><path d="M16 9.5a4 4 0 0 1 0 5"></path><path d="M18.5 7a7.5 7.5 0 0 1 0 10"></path></svg>' +
          '</span>' +
          '<span class="blog-audio-reader-copy">' +
            '<span class="blog-audio-reader-label">Listen to this piece</span>' +
            '<span class="blog-audio-reader-status" aria-live="polite">Play audio</span>' +
          '</span>' +
        '</button>' +
        '<button type="button" class="blog-audio-reader-stop" data-audio-action="stop" hidden>Stop</button>' +
      '</div>';
  };

  BlogAudioReader.prototype.bind = function () {
    if (!this.supported) return;
    var toggle = this.root.querySelector('[data-audio-action="toggle"]');
    var stop = this.root.querySelector('[data-audio-action="stop"]');
    toggle.addEventListener("click", this.toggle.bind(this));
    stop.addEventListener("click", this.stop.bind(this));
    window.addEventListener("pagehide", this.handlePageExit);
    window.addEventListener("beforeunload", this.handlePageExit);
  };

  BlogAudioReader.prototype.setState = function (state) {
    this.state = state;
    var reader = this.root.querySelector(".blog-audio-reader");
    var toggle = this.root.querySelector('[data-audio-action="toggle"]');
    var stop = this.root.querySelector('[data-audio-action="stop"]');
    var status = this.root.querySelector(".blog-audio-reader-status");
    if (!reader || !toggle || !stop || !status) return;

    reader.dataset.readerState = state;
    stop.hidden = state === "idle";
    if (state === "reading") {
      status.textContent = "Pause";
      toggle.setAttribute("aria-label", "Pause audio reading");
    } else if (state === "paused") {
      status.textContent = "Resume";
      toggle.setAttribute("aria-label", "Resume audio reading");
    } else {
      status.textContent = "Play audio";
      toggle.setAttribute("aria-label", "Listen to this piece");
    }
  };

  BlogAudioReader.prototype.toggle = function () {
    if (this.state === "reading") {
      synthesis.pause();
      this.setState("paused");
      return;
    }
    if (this.state === "paused") {
      synthesis.resume();
      this.setState("reading");
      return;
    }
    this.start();
  };

  BlogAudioReader.prototype.start = function () {
    if (activeReader && activeReader !== this) activeReader.stop();
    synthesis.cancel();
    this.chunks = extractArticleChunks(this.content);
    this.index = 0;
    if (!this.chunks.length) {
      var status = this.root.querySelector(".blog-audio-reader-status");
      if (status) status.textContent = "No article text available";
      return;
    }
    activeReader = this;
    this.setState("reading");
    this.speakNext();
  };

  BlogAudioReader.prototype.speakNext = function () {
    var self = this;
    if (this.state === "idle" || this.index >= this.chunks.length) {
      this.finish();
      return;
    }

    var utterance = new SpeechSynthesisUtterance(this.chunks[this.index]);
    utterance.lang = this.language;
    utterance.rate = this.rate;
    utterance.onend = function () {
      if (self.state === "idle") return;
      self.index += 1;
      self.speakNext();
    };
    utterance.onerror = function (event) {
      if (event.error === "canceled" || event.error === "interrupted") return;
      self.finish();
      var status = self.root.querySelector(".blog-audio-reader-status");
      if (status) status.textContent = "Audio could not start";
    };
    this.utterance = utterance;
    synthesis.speak(utterance);
  };

  BlogAudioReader.prototype.finish = function () {
    this.utterance = null;
    this.index = 0;
    if (activeReader === this) activeReader = null;
    this.setState("idle");
  };

  BlogAudioReader.prototype.stop = function () {
    if (this.supported) synthesis.cancel();
    this.finish();
  };

  BlogAudioReader.prototype.destroy = function () {
    this.stop();
    window.removeEventListener("pagehide", this.handlePageExit);
    window.removeEventListener("beforeunload", this.handlePageExit);
    this.root.innerHTML = "";
  };

  window.BlogAudioReader = {
    mount: function (options) {
      if (activeReader) activeReader.destroy();
      activeReader = new BlogAudioReader(options);
      return activeReader;
    },
    stop: function () {
      if (activeReader) activeReader.stop();
      else if (synthesis) synthesis.cancel();
    },
    unmount: function () {
      if (!activeReader) {
        if (synthesis) synthesis.cancel();
        return;
      }
      var reader = activeReader;
      activeReader = null;
      reader.destroy();
    },
    extractArticleChunks: extractArticleChunks
  };
})();
